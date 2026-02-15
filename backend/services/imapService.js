const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

class ImapService {
    constructor(email, password) {
        this.email = email;
        this.password = password;
        this.client = null;
    }

    async connect() {
        this.client = new ImapFlow({
            host: process.env.MAIL_HOST,
            port: parseInt(process.env.IMAP_PORT),
            secure: process.env.MAIL_SECURE === 'true',
            auth: {
                user: this.email,
                pass: this.password
            },
            logger: false,
            tls: {
                rejectUnauthorized: false
            }
        });
        await this.client.connect();
        return this.client;
    }

    async disconnect() {
        if (this.client) {
            await this.client.logout();
            this.client = null;
        }
    }

    async listMailboxes() {
        try {
            await this.connect();
            const mailboxes = await this.client.list();
            await this.disconnect();
            return mailboxes;
        } catch (error) {
            await this.disconnect();
            throw error;
        }
    }

    // Map UI folder names to actual IMAP folder names
    _mapFolderName(folder) {
        const map = {
            'Spam': 'Junk',
            'Trash': 'Trash',
            'Sent': 'Sent',
            'Drafts': 'Drafts',
            'INBOX': 'INBOX',
        };
        return map[folder] || folder;
    }

    // Check if it's a virtual folder (not a real IMAP mailbox)
    _isVirtualFolder(folder) {
        return ['Starred', 'All Mail', 'Snoozed', 'Important'].includes(folder);
    }

    async getMessages(folder = 'INBOX', page = 1, limit = 50) {
        try {
            await this.connect();

            // Handle virtual folders
            if (this._isVirtualFolder(folder)) {
                return await this._getVirtualFolderMessages(folder, page, limit);
            }

            const imapFolder = this._mapFolderName(folder);
            const lock = await this.client.getMailboxLock(imapFolder);

            try {
                const status = await this.client.status(imapFolder, { messages: true, unseen: true });
                const total = status.messages;
                const totalPages = Math.ceil(total / limit);
                const startSeq = Math.max(1, total - (page * limit) + 1);
                const endSeq = Math.max(1, total - ((page - 1) * limit));

                if (total === 0) {
                    return { messages: [], total: 0, page, totalPages: 0, unseen: status.unseen };
                }

                const messages = [];
                const range = `${startSeq}:${endSeq}`;

                for await (const msg of this.client.fetch(range, {
                    uid: true,
                    flags: true,
                    envelope: true,
                    bodyStructure: true,
                    size: true
                })) {
                    const envelope = msg.envelope;

                    // Safe address parser - handles undefined mailbox/host
                    const parseAddr = (a) => {
                        const address = (a.mailbox && a.host)
                            ? `${a.mailbox}@${a.host}`
                            : (a.address || a.mailbox || '');
                        return { name: a.name || '', address };
                    };

                    messages.push({
                        uid: msg.uid,
                        seq: msg.seq,
                        flags: Array.from(msg.flags || []),
                        subject: envelope.subject || '(No Subject)',
                        from: envelope.from ? envelope.from.map(parseAddr) : [],
                        to: envelope.to ? envelope.to.map(parseAddr) : [],
                        cc: envelope.cc ? envelope.cc.map(parseAddr) : [],
                        date: envelope.date,
                        messageId: envelope.messageId,
                        size: msg.size,
                        hasAttachments: this._hasAttachments(msg.bodyStructure),
                        isRead: msg.flags.has('\\Seen'),
                        isStarred: msg.flags.has('\\Flagged'),
                        isDraft: msg.flags.has('\\Draft'),
                        folder: imapFolder
                    });
                }

                // Sort messages by date descending (newest first)
                messages.sort((a, b) => new Date(b.date) - new Date(a.date));

                return {
                    messages,
                    total,
                    page,
                    totalPages,
                    unseen: status.unseen
                };
            } finally {
                lock.release();
            }
        } catch (error) {
            throw error;
        } finally {
            await this.disconnect();
        }
    }

    async _getVirtualFolderMessages(folder, page, limit) {
        const parseAddr = (a) => {
            const address = (a.mailbox && a.host)
                ? `${a.mailbox}@${a.host}`
                : (a.address || a.mailbox || '');
            return { name: a.name || '', address };
        };

        const fetchFromFolder = async (folderName, searchQuery = null) => {
            const messages = [];
            try {
                const lock = await this.client.getMailboxLock(folderName);
                try {
                    let uids;
                    if (searchQuery) {
                        uids = await this.client.search(searchQuery);
                    } else {
                        const status = await this.client.status(folderName, { messages: true });
                        if (status.messages === 0) return [];
                        const start = Math.max(1, status.messages - limit + 1);
                        uids = `${start}:${status.messages}`;
                    }

                    if (!uids || (Array.isArray(uids) && uids.length === 0)) return [];

                    const fetchOpts = {
                        uid: true,
                        flags: true,
                        envelope: true,
                        bodyStructure: true,
                        size: true
                    };

                    // If uids is an array (from search), use uid-based fetch
                    const range = Array.isArray(uids) ? uids.join(',') : uids;
                    const isUid = Array.isArray(uids);

                    for await (const msg of this.client.fetch(range, fetchOpts, { uid: isUid })) {
                        const envelope = msg.envelope;
                        messages.push({
                            uid: msg.uid,
                            seq: msg.seq,
                            flags: Array.from(msg.flags || []),
                            subject: envelope.subject || '(No Subject)',
                            from: envelope.from ? envelope.from.map(parseAddr) : [],
                            to: envelope.to ? envelope.to.map(parseAddr) : [],
                            cc: envelope.cc ? envelope.cc.map(parseAddr) : [],
                            date: envelope.date,
                            messageId: envelope.messageId,
                            size: msg.size,
                            hasAttachments: this._hasAttachments(msg.bodyStructure),
                            isRead: msg.flags.has('\\Seen'),
                            isStarred: msg.flags.has('\\Flagged'),
                            isDraft: msg.flags.has('\\Draft'),
                            folder: folderName
                        });
                    }
                } finally {
                    lock.release();
                }
            } catch (err) {
                // Folder might not exist, skip silently
                console.log(`Virtual folder: skipping ${folderName} - ${err.message}`);
            }
            return messages;
        };

        let allMessages = [];

        if (folder === 'All Mail') {
            // Aggregate from all main folders
            const folders = ['INBOX', 'Sent', 'Drafts', 'Junk', 'Trash'];
            for (const f of folders) {
                const msgs = await fetchFromFolder(f);
                allMessages.push(...msgs);
            }
        } else if (folder === 'Starred') {
            // Search for flagged messages in INBOX
            const msgs = await fetchFromFolder('INBOX', { flagged: true });
            allMessages.push(...msgs);
        } else if (folder === 'Important' || folder === 'Snoozed') {
            // Fallback to INBOX for unsupported virtual folders
            const msgs = await fetchFromFolder('INBOX');
            allMessages.push(...msgs);
        }

        // Sort by date descending
        allMessages.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Manual pagination
        const total = allMessages.length;
        const totalPages = Math.ceil(total / limit);
        const startIdx = (page - 1) * limit;
        const paged = allMessages.slice(startIdx, startIdx + limit);

        return {
            messages: paged,
            total,
            page,
            totalPages,
            unseen: 0
        };
    }

    async getMessage(folder, uid) {
        try {
            await this.connect();
            const imapFolder = this._isVirtualFolder(folder) ? 'INBOX' : this._mapFolderName(folder);
            const lock = await this.client.getMailboxLock(imapFolder);

            try {
                const source = await this.client.download(uid, undefined, { uid: true });

                // Mark as read
                await this.client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });

                const parsed = await simpleParser(source.content);

                const attachments = (parsed.attachments || []).map((att, index) => ({
                    id: index,
                    filename: att.filename || 'attachment',
                    contentType: att.contentType,
                    size: att.size,
                    contentId: att.contentId,
                    content: att.content.toString('base64')
                }));

                return {
                    uid,
                    subject: parsed.subject || '(No Subject)',
                    from: parsed.from ? parsed.from.value.map(a => ({
                        name: a.name || '',
                        address: a.address
                    })) : [],
                    to: parsed.to ? (Array.isArray(parsed.to.value) ? parsed.to.value : [parsed.to.value]).map(a => ({
                        name: a.name || '',
                        address: a.address
                    })) : [],
                    cc: parsed.cc ? (Array.isArray(parsed.cc.value) ? parsed.cc.value : [parsed.cc.value]).map(a => ({
                        name: a.name || '',
                        address: a.address
                    })) : [],
                    bcc: parsed.bcc ? (Array.isArray(parsed.bcc.value) ? parsed.bcc.value : [parsed.bcc.value]).map(a => ({
                        name: a.name || '',
                        address: a.address
                    })) : [],
                    date: parsed.date,
                    html: parsed.html || null,
                    text: parsed.text || '',
                    attachments,
                    headers: {
                        messageId: parsed.messageId,
                        inReplyTo: parsed.inReplyTo,
                        references: parsed.references
                    }
                };
            } finally {
                lock.release();
            }
        } catch (error) {
            throw error;
        } finally {
            await this.disconnect();
        }
    }

    async searchMessages(folder, query) {
        try {
            await this.connect();
            const imapFolder = this._mapFolderName(folder);
            const lock = await this.client.getMailboxLock(imapFolder);

            try {
                const searchResults = await this.client.search({
                    or: [
                        { subject: query },
                        { from: query },
                        { to: query },
                        { body: query }
                    ]
                });

                if (!searchResults || searchResults.length === 0) {
                    return { messages: [], total: 0 };
                }

                const messages = [];
                for await (const msg of this.client.fetch(searchResults, {
                    uid: true,
                    flags: true,
                    envelope: true,
                    bodyStructure: true,
                    size: true
                })) {
                    const envelope = msg.envelope;

                    // Safe address parser
                    const parseAddr = (a) => {
                        const address = (a.mailbox && a.host)
                            ? `${a.mailbox}@${a.host}`
                            : (a.address || a.mailbox || '');
                        return { name: a.name || '', address };
                    };

                    messages.push({
                        uid: msg.uid,
                        seq: msg.seq,
                        flags: Array.from(msg.flags || []),
                        subject: envelope.subject || '(No Subject)',
                        from: envelope.from ? envelope.from.map(parseAddr) : [],
                        to: envelope.to ? envelope.to.map(parseAddr) : [],
                        date: envelope.date,
                        hasAttachments: this._hasAttachments(msg.bodyStructure),
                        isRead: msg.flags.has('\\Seen'),
                        isStarred: msg.flags.has('\\Flagged')
                    });
                }

                messages.sort((a, b) => new Date(b.date) - new Date(a.date));

                return { messages, total: messages.length };
            } finally {
                lock.release();
            }
        } catch (error) {
            throw error;
        } finally {
            await this.disconnect();
        }
    }

    async toggleFlag(folder, uid, flag, add = true) {
        try {
            await this.connect();
            const imapFolder = this._mapFolderName(folder);
            const lock = await this.client.getMailboxLock(imapFolder);

            try {
                if (add) {
                    await this.client.messageFlagsAdd(uid, [flag], { uid: true });
                } else {
                    await this.client.messageFlagsRemove(uid, [flag], { uid: true });
                }
                return true;
            } finally {
                lock.release();
            }
        } catch (error) {
            throw error;
        } finally {
            await this.disconnect();
        }
    }

    async moveMessage(uid, fromFolder, toFolder) {
        try {
            await this.connect();
            const imapFrom = this._mapFolderName(fromFolder);
            const imapTo = this._mapFolderName(toFolder);
            const lock = await this.client.getMailboxLock(imapFrom);

            try {
                await this.client.messageMove(uid, imapTo, { uid: true });
                return true;
            } finally {
                lock.release();
            }
        } catch (error) {
            throw error;
        } finally {
            await this.disconnect();
        }
    }

    async deleteMessage(folder, uid) {
        try {
            await this.connect();
            const imapFolder = this._mapFolderName(folder);
            const lock = await this.client.getMailboxLock(imapFolder);

            try {
                await this.client.messageFlagsAdd(uid, ['\\Deleted'], { uid: true });
                await this.client.expunge();
                return true;
            } finally {
                lock.release();
            }
        } catch (error) {
            throw error;
        } finally {
            await this.disconnect();
        }
    }

    async appendToSent(rawMessage) {
        try {
            await this.connect();

            // Find the Sent folder - Mailcow/Dovecot usually uses "Sent"
            const sentFolder = await this._findSentFolder();

            await this.client.append(sentFolder, rawMessage, ['\\Seen'], new Date());

            return true;
        } catch (error) {
            console.error('Append to Sent error:', error);
            // Don't throw - email was already sent, this is a secondary operation
            return false;
        } finally {
            await this.disconnect();
        }
    }

    async saveDraft(rawMessage) {
        try {
            await this.connect();
            const draftsFolder = await this._findDraftsFolder();
            await this.client.append(draftsFolder, rawMessage, ['\\Seen', '\\Draft'], new Date());
            return true;
        } catch (error) {
            console.error('Save draft error:', error);
            throw error;
        } finally {
            await this.disconnect();
        }
    }

    async deleteDraft(uid) {
        try {
            await this.connect();
            const draftsFolder = await this._findDraftsFolder();
            const lock = await this.client.getMailboxLock(draftsFolder);
            try {
                await this.client.messageFlagsAdd(uid, ['\\Deleted'], { uid: true });
                await this.client.expunge();
                return true;
            } finally {
                lock.release();
            }
        } catch (error) {
            console.error('Delete draft error:', error);
            // Don't throw - this is a cleanup operation
            return false;
        } finally {
            await this.disconnect();
        }
    }

    async _findDraftsFolder() {
        const mailboxes = await this.client.list();
        const draftNames = ['Drafts', 'Draft', 'INBOX.Drafts', 'INBOX/Drafts'];

        for (const box of mailboxes) {
            if (draftNames.includes(box.path) ||
                (box.specialUse && box.specialUse === '\\Drafts')) {
                return box.path;
            }
        }

        // Fallback
        return 'Drafts';
    }

    async _findSentFolder() {
        const mailboxes = await this.client.list();
        // Look for common Sent folder names
        const sentNames = ['Sent', 'Sent Messages', 'Sent Items', 'INBOX.Sent', 'INBOX/Sent'];

        for (const box of mailboxes) {
            if (sentNames.includes(box.path) ||
                (box.specialUse && box.specialUse === '\\Sent')) {
                return box.path;
            }
        }

        // Fallback
        return 'Sent';
    }

    _hasAttachments(bodyStructure) {
        if (!bodyStructure) return false;
        if (bodyStructure.disposition === 'attachment') return true;
        if (bodyStructure.childNodes) {
            return bodyStructure.childNodes.some(child => this._hasAttachments(child));
        }
        return false;
    }
}

module.exports = ImapService;
