// バックグラウンドスクリプト（Service Worker）
// Chrome拡張機能のバックグラウンド処理を管理

class BackgroundService {
    constructor() {
        this.setupEventListeners();
        this.initializeExtension();
    }
    
    // イベントリスナーの設定
    setupEventListeners() {
        // 拡張機能インストール時の処理
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstallation(details);
        });
        
        // 拡張機能起動時の処理
        chrome.runtime.onStartup.addListener(() => {
            this.handleStartup();
        });
        
        // アクションボタンクリック時の処理
        chrome.action.onClicked.addListener((tab) => {
            this.handleActionClick(tab);
        });
        
        // メッセージ受信の処理
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // 非同期レスポンスを許可
        });
        
        // ダウンロード完了時の処理
        chrome.downloads.onChanged.addListener((downloadDelta) => {
            this.handleDownloadChange(downloadDelta);
        });
        
        // コンテキストメニューの設定
        this.setupContextMenus();
    }
    
    // 拡張機能の初期化
    async initializeExtension() {
        try {
            // デフォルト設定の設定
            await this.setDefaultSettings();
            
            console.log('Smart URL Shortcut Generator: 初期化完了');
        } catch (error) {
            console.error('初期化エラー:', error);
        }
    }
    
    // インストール時の処理
    handleInstallation(details) {
        console.log('Smart URL Shortcut Generator: インストール完了', details);
        
        if (details.reason === 'install') {
            // 初回インストール時の処理
            this.showWelcomeNotification();
        } else if (details.reason === 'update') {
            // アップデート時の処理
            this.handleUpdate(details.previousVersion);
        }
    }
    
    // 起動時の処理
    handleStartup() {
        console.log('Smart URL Shortcut Generator: 起動');
    }
    
    // アクションボタンクリック時の処理
    async handleActionClick(tab) {
        try {
            // ポップアップが設定されている場合は自動で開かれるため、
            // 特別な処理は不要だが、エラー処理として残す
            console.log('アクションボタンがクリックされました:', tab.url);
        } catch (error) {
            console.error('アクションクリックエラー:', error);
        }
    }
    
    // メッセージハンドリング
    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'generateUrlFile':
                    await this.generateUrlFile(request.data, sendResponse);
                    break;
                    
                case 'saveSettings':
                    await this.saveSettings(request.settings, sendResponse);
                    break;
                    
                case 'loadSettings':
                    await this.loadSettings(sendResponse);
                    break;
                    
                case 'analyzeCurrentPage':
                    await this.analyzeCurrentPage(request.tabId, sendResponse);
                    break;
                    
                default:
                    sendResponse({ error: '不明なアクション' });
            }
        } catch (error) {
            console.error('メッセージ処理エラー:', error);
            sendResponse({ error: error.message });
        }
    }
    
    // .urlファイルの生成とダウンロード
    async generateUrlFile(data, sendResponse) {
        try {
            const { filename, url, title } = data;
            
            // .urlファイルの内容を生成
            const urlFileContent = `[InternetShortcut]\nURL=${url}\n`;
            
            // .urlファイル用の適切なMIMEタイプでData URIを作成
            // Base64エンコーディングを使用してバイナリデータとして扱う
            const base64Content = btoa(unescape(encodeURIComponent(urlFileContent)));
            const dataUri = `data:application/x-mswinurl;base64,${base64Content}`;
            
            // ダウンロードを実行
            const downloadId = await chrome.downloads.download({
                url: dataUri,
                filename: `${filename}.url`,
                saveAs: false
            });
            
            sendResponse({ 
                success: true, 
                downloadId: downloadId,
                message: 'ファイルのダウンロードを開始しました'
            });
            
        } catch (error) {
            console.error('.urlファイル生成エラー:', error);
            sendResponse({ 
                success: false, 
                error: error.message 
            });
        }
    }
    
    // 現在ページの解析
    async analyzeCurrentPage(tabId, sendResponse) {
        try {
            if (!tabId) {
                throw new Error('TabIDが指定されていません');
            }
            
            // タブ情報を取得
            const tab = await chrome.tabs.get(tabId);
            
            // コンテンツスクリプトへの通信を試行
            try {
                const response = await chrome.tabs.sendMessage(tabId, {
                    action: 'analyzePageContent'
                });
                
                if (response && response.success) {
                    sendResponse(response);
                    return;
                }
            } catch (contentScriptError) {
                console.warn('コンテンツスクリプト通信失敗、代替手段を使用:', contentScriptError);
            }
            
            // 代替手段: タブ情報から基本的なページデータを生成
            const fallbackData = this.generateFallbackPageData(tab);
            
            sendResponse({
                success: true,
                data: fallbackData,
                fallback: true
            });
            
        } catch (error) {
            console.error('ページ解析エラー:', error);
            
            sendResponse({ 
                success: false, 
                error: `ページ解析に失敗しました: ${error.message}` 
            });
        }
    }
    
    // 代替ページデータの生成
    generateFallbackPageData(tab) {
        const url = tab.url || '';
        const title = tab.title || '';
        
        // 基本的なキーワードをタイトルから抽出
        const keywords = this.extractBasicKeywords(title);
        
        return {
            title: title,
            url: url,
            metaKeywords: '',
            metaDescription: '',
            headings: [{ level: 1, text: title }],
            mainText: title,
            images: [],
            links: [],
            keywords: keywords
        };
    }
    
    // 基本的なキーワード抽出
    extractBasicKeywords(text) {
        if (!text) return [];
        
        // 簡易的なキーワード抽出
        const words = text
            .replace(/[<>:"/\\|?*]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .filter(word => word.length >= 2 && word.length <= 20)
            .slice(0, 5);
            
        return words;
    }
    
    // 設定の保存
    async saveSettings(settings, sendResponse) {
        try {
            await chrome.storage.sync.set({ userSettings: settings });
            sendResponse({ success: true });
        } catch (error) {
            console.error('設定保存エラー:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    // 設定の読み込み
    async loadSettings(sendResponse) {
        try {
            const result = await chrome.storage.sync.get('userSettings');
            const settings = result.userSettings || this.getDefaultSettings();
            sendResponse({ success: true, settings: settings });
        } catch (error) {
            console.error('設定読み込みエラー:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    // デフォルト設定の設定
    async setDefaultSettings() {
        try {
            const result = await chrome.storage.sync.get('userSettings');
            if (!result.userSettings) {
                const defaultSettings = this.getDefaultSettings();
                await chrome.storage.sync.set({ userSettings: defaultSettings });
            }
        } catch (error) {
            console.error('デフォルト設定エラー:', error);
        }
    }
    
    // デフォルト設定の取得
    getDefaultSettings() {
        return {
            downloadFolder: '', // デフォルトダウンロードフォルダ
            filenameTemplate: '{keywords}', // ファイル名テンプレート
            maxKeywords: 5, // 最大キーワード数
            analysisMode: 'simple', // 解析モード（simple/detailed）
            autoDownload: false, // 自動ダウンロード
            showNotifications: true // 通知表示
        };
    }
    
    // コンテキストメニューの設定
    setupContextMenus() {
        // chrome.contextMenusが利用可能かチェック
        if (!chrome.contextMenus) {
            console.warn('chrome.contextMenus API が利用できません。権限を確認してください。');
            return;
        }
        
        try {
            chrome.contextMenus.removeAll(() => {
                chrome.contextMenus.create({
                    id: 'create-url-shortcut',
                    title: 'URLショートカットを作成',
                    contexts: ['page', 'link']
                });
                
                chrome.contextMenus.create({
                    id: 'create-url-shortcut-link',
                    title: 'このリンクのショートカットを作成',
                    contexts: ['link']
                });
            });
            
            // コンテキストメニュークリック時の処理
            chrome.contextMenus.onClicked.addListener((info, tab) => {
                this.handleContextMenuClick(info, tab);
            });
        } catch (error) {
            console.error('コンテキストメニュー設定エラー:', error);
        }
    }
    
    // コンテキストメニュークリック時の処理
    async handleContextMenuClick(info, tab) {
        try {
            let targetUrl = tab.url;
            let targetTitle = tab.title;
            
            if (info.menuItemId === 'create-url-shortcut-link' && info.linkUrl) {
                targetUrl = info.linkUrl;
                targetTitle = info.selectionText || info.linkUrl;
            }
            
            // 簡易的なファイル名を生成
            const filename = this.generateSimpleFilename(targetTitle, targetUrl);
            
            // ダウンロードを実行
            await this.generateUrlFile({
                filename: filename,
                url: targetUrl,
                title: targetTitle
            }, (response) => {
                if (response.success) {
                    this.showNotification('URLショートカットを作成しました', 'success');
                } else {
                    this.showNotification('作成に失敗しました', 'error');
                }
            });
            
        } catch (error) {
            console.error('コンテキストメニューエラー:', error);
            this.showNotification('エラーが発生しました', 'error');
        }
    }
    
    // 簡易ファイル名生成
    generateSimpleFilename(title, url) {
        try {
            const domain = new URL(url).hostname.replace('www.', '');
            const cleanTitle = title
                .replace(/[<>:"/\\|?*]/g, '')
                .replace(/\s+/g, '_')
                .substring(0, 50);
            
            return cleanTitle || domain;
        } catch (error) {
            return `shortcut_${Date.now()}`;
        }
    }
    
    // ダウンロード状態変更時の処理
    handleDownloadChange(downloadDelta) {
        if (downloadDelta.state && downloadDelta.state.current === 'complete') {
            console.log('ダウンロード完了:', downloadDelta.id);
            this.showNotification('URLショートカットのダウンロードが完了しました', 'success');
        } else if (downloadDelta.state && downloadDelta.state.current === 'interrupted') {
            console.log('ダウンロード中断:', downloadDelta.id);
            this.showNotification('ダウンロードが中断されました', 'error');
        }
    }
    
    // 通知表示
    showNotification(message, type = 'info') {
        try {
            // chrome.notifications が利用可能かチェック
            if (!chrome.notifications) {
                console.log('通知:', message);
                return;
            }
            
            chrome.notifications.create({
                type: 'basic',
                title: 'Smart URL Shortcut Generator',
                message: message,
                iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' // 1x1透明PNG
            }, (notificationId) => {
                if (chrome.runtime.lastError) {
                    console.log('通知:', message);
                }
            });
        } catch (error) {
            console.log('通知:', message);
        }
    }
    
    // ウェルカム通知
    showWelcomeNotification() {
        this.showNotification('インストールありがとうございます！ツールバーのアイコンをクリックして開始してください。', 'info');
    }
    
    // アップデート処理
    handleUpdate(previousVersion) {
        console.log(`アップデート完了: ${previousVersion} → ${chrome.runtime.getManifest().version}`);
        this.showNotification('アップデートが完了しました', 'info');
    }
}

// バックグラウンドサービスの初期化
new BackgroundService();