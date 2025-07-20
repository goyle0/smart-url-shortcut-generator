// ポップアップのメイン処理
class URLShortcutPopup {
    constructor() {
        this.currentTab = null;
        this.pageInfo = null;
        this.generatedFilename = '';
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadCurrentPage();
    }
    
    // DOM要素の初期化
    initializeElements() {
        this.elements = {
            pageTitle: document.getElementById('page-title'),
            pageUrl: document.getElementById('page-url'),
            filenamePreview: document.getElementById('filename-preview'),
            filenameInput: document.getElementById('filename-input'),
            downloadFolder: document.getElementById('download-folder'),
            analyzeBtn: document.getElementById('analyze-btn'),
            downloadBtn: document.getElementById('download-btn'),
            status: document.getElementById('status')
        };
    }
    
    // イベントリスナーの設定
    setupEventListeners() {
        this.elements.analyzeBtn.addEventListener('click', () => {
            this.analyzeCurrentPage();
        });
        
        this.elements.downloadBtn.addEventListener('click', () => {
            this.downloadUrlFile();
        });
        
        this.elements.filenameInput.addEventListener('input', (e) => {
            this.updateFilenamePreview(e.target.value);
        });
        
        // 設定の保存・読み込み
        this.elements.downloadFolder.addEventListener('change', () => {
            this.saveSettings();
        });
        
        this.loadSettings();
    }
    
    // 現在のページ情報を取得
    async loadCurrentPage() {
        try {
            this.showStatus('ページ情報を取得中...', 'info');
            
            // Chrome APIを使用して現在のタブ情報を取得
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTab = tab;
            
            // ページ情報を表示
            this.displayPageInfo(tab);
            
            // ページ解析を実行
            await this.analyzeCurrentPage();
            
            this.hideStatus();
        } catch (error) {
            console.error('ページ情報取得エラー:', error);
            this.showStatus('ページ情報の取得に失敗しました', 'error');
        }
    }
    
    // ページ情報の表示
    displayPageInfo(tab) {
        this.elements.pageTitle.textContent = tab.title || 'タイトルなし';
        this.elements.pageUrl.textContent = tab.url || 'URLなし';
        
        this.pageInfo = {
            title: tab.title,
            url: tab.url
        };
    }
    
    // ページ解析の実行
    async analyzeCurrentPage() {
        try {
            this.showStatus('ページを解析中...', 'info');
            this.elements.analyzeBtn.disabled = true;
            
            // background.js経由でコンテンツスクリプトと通信
            const response = await chrome.runtime.sendMessage({
                action: 'analyzeCurrentPage',
                tabId: this.currentTab.id
            });
            
            if (response && response.success) {
                const pageContent = response.data;
                
                // ファイル名を生成
                const filename = this.generateFilename(pageContent);
                this.generatedFilename = filename;
                
                // プレビューと入力フィールドを更新
                this.updateFilenamePreview(filename);
                this.elements.filenameInput.value = filename;
                
                // 代替手段が使われた場合の通知
                if (response.fallback) {
                    this.showStatus('基本情報から解析しました（詳細解析は利用できませんでした）', 'info');
                    setTimeout(() => this.hideStatus(), 3000);
                } else {
                    this.hideStatus();
                }
            } else {
                throw new Error(response?.error || 'ページ解析に失敗しました');
            }
        } catch (error) {
            console.error('ページ解析エラー:', error);
            this.showStatus(`ページ解析に失敗しました: ${error.message}`, 'error');
        } finally {
            this.elements.analyzeBtn.disabled = false;
        }
    }
    
    
    // ファイル名の生成
    generateFilename(pageContent) {
        let keywords = [];
        
        // content.jsからキーワードが提供されている場合は優先使用
        if (pageContent.keywords && Array.isArray(pageContent.keywords)) {
            keywords = pageContent.keywords.slice(0, 5); // 最大5つ
        } else {
            // フォールバック: 自動抽出
            if (pageContent.title) {
                const titleWords = this.extractKeywords(pageContent.title);
                keywords.push(...titleWords.slice(0, 3));
            }
            
            if (pageContent.metaKeywords) {
                const metaWords = pageContent.metaKeywords.split(',').map(w => w.trim());
                keywords.push(...metaWords.slice(0, 2));
            }
        }
        
        // 重複除去と整理
        const uniqueKeywords = [...new Set(keywords)]
            .filter(word => word && word.length >= 2 && word.length <= 20)
            .slice(0, 5); // 最大5つのキーワード
        
        // ファイル名の生成
        if (uniqueKeywords.length === 0) {
            // キーワードがない場合のフォールバック
            try {
                const domain = new URL(pageContent.url).hostname.replace('www.', '');
                return `${domain}_page_${Date.now()}`;
            } catch {
                return `shortcut_${Date.now()}`;
            }
        }
        
        // Windowsファイル名に使用できない文字を除去
        const cleanKeywords = uniqueKeywords.map(word => 
            String(word).replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_')
        );
        
        return cleanKeywords.join('_');
    }
    
    // 簡易的なキーワード抽出
    extractKeywords(text) {
        if (!text) return [];
        
        // 基本的な単語分割（日本語対応の簡易版）
        const words = [];
        
        // 英数字の単語
        const englishWords = text.match(/[a-zA-Z0-9]+/g) || [];
        words.push(...englishWords);
        
        // 日本語の名詞的な表現（簡易的）
        const japanesePatterns = [
            /[ァ-ヶー]{2,10}/g, // カタカナ
            /[一-龯]{2,8}/g,    // 漢字
        ];
        
        japanesePatterns.forEach(pattern => {
            const matches = text.match(pattern) || [];
            words.push(...matches);
        });
        
        // 頻度の高い単語を除外
        const stopWords = ['です', 'ます', 'こと', 'ため', 'について', 'から', 'まで', 'の', 'に', 'を', 'は', 'が', 'で', 'と', 'a', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
        
        return words
            .filter(word => word.length >= 2 && !stopWords.includes(word.toLowerCase()))
            .slice(0, 10);
    }
    
    // ファイル名プレビューの更新
    updateFilenamePreview(filename) {
        this.elements.filenamePreview.textContent = `${filename}.url`;
    }
    
    // .urlファイルのダウンロード
    async downloadUrlFile() {
        try {
            const filename = this.elements.filenameInput.value.trim();
            if (!filename) {
                this.showStatus('ファイル名を入力してください', 'error');
                return;
            }
            
            this.showStatus('ファイルを生成中...', 'info');
            this.elements.downloadBtn.disabled = true;
            
            // background.js経由でダウンロードを実行
            const response = await chrome.runtime.sendMessage({
                action: 'generateUrlFile',
                data: {
                    filename: filename,
                    url: this.pageInfo.url,
                    title: this.pageInfo.title
                }
            });
            
            if (response && response.success) {
                this.showStatus('ダウンロードが完了しました！', 'success');
            } else {
                throw new Error(response?.error || 'ダウンロードに失敗しました');
            }
        } catch (error) {
            console.error('ダウンロードエラー:', error);
            this.showStatus(`ダウンロードに失敗しました: ${error.message}`, 'error');
        } finally {
            this.elements.downloadBtn.disabled = false;
        }
    }
    
    
    // 設定の保存
    async saveSettings() {
        const settings = {
            downloadFolder: this.elements.downloadFolder.value
        };
        
        await chrome.storage.sync.set({ settings });
    }
    
    // 設定の読み込み
    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get('settings');
            const settings = result.settings || {};
            
            if (settings.downloadFolder) {
                this.elements.downloadFolder.value = settings.downloadFolder;
            }
        } catch (error) {
            console.error('設定読み込みエラー:', error);
        }
    }
    
    // ステータス表示
    showStatus(message, type = 'info') {
        this.elements.status.textContent = message;
        this.elements.status.className = `status ${type}`;
        this.elements.status.classList.remove('hidden');
    }
    
    // ステータス非表示
    hideStatus() {
        this.elements.status.classList.add('hidden');
    }
}

// ポップアップが読み込まれたときに初期化
document.addEventListener('DOMContentLoaded', () => {
    new URLShortcutPopup();
});