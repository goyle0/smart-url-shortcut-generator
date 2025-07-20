// コンテンツスクリプト - ページの詳細情報を取得
(function() {
    'use strict';
    
    // ページ解析クラス
    class PageAnalyzer {
        constructor() {
            this.pageData = {
                title: '',
                url: '',
                metaKeywords: '',
                metaDescription: '',
                headings: [],
                mainText: '',
                images: [],
                links: []
            };
        }
        
        // ページの全体解析
        analyze() {
            this.extractBasicInfo();
            this.extractMetadata();
            this.extractStructuredContent();
            this.extractSemanticContent();
            
            return this.pageData;
        }
        
        // 基本情報の抽出
        extractBasicInfo() {
            this.pageData.title = document.title || '';
            this.pageData.url = window.location.href || '';
        }
        
        // メタデータの抽出
        extractMetadata() {
            // メタキーワード
            const keywordsMeta = document.querySelector('meta[name="keywords"]');
            if (keywordsMeta) {
                this.pageData.metaKeywords = keywordsMeta.content.trim();
            }
            
            // メタディスクリプション
            const descriptionMeta = document.querySelector('meta[name="description"]');
            if (descriptionMeta) {
                this.pageData.metaDescription = descriptionMeta.content.trim();
            }
            
            // Open Graphデータも取得
            const ogTitle = document.querySelector('meta[property="og:title"]');
            const ogDescription = document.querySelector('meta[property="og:description"]');
            
            if (ogTitle && !this.pageData.title) {
                this.pageData.title = ogTitle.content.trim();
            }
            
            if (ogDescription && !this.pageData.metaDescription) {
                this.pageData.metaDescription = ogDescription.content.trim();
            }
        }
        
        // 構造化コンテンツの抽出
        extractStructuredContent() {
            // 見出しの抽出
            const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            this.pageData.headings = Array.from(headings)
                .map(h => ({
                    level: parseInt(h.tagName.charAt(1)),
                    text: h.textContent.trim()
                }))
                .filter(h => h.text.length > 0 && h.text.length < 200);
            
            // 主要なテキストコンテンツの抽出
            this.extractMainText();
        }
        
        // メインテキストの抽出
        extractMainText() {
            // 優先順位でメインコンテンツエリアを特定
            const contentSelectors = [
                'main',
                'article',
                '[role="main"]',
                '.content',
                '#content',
                '.main',
                '#main',
                '.post-content',
                '.entry-content',
                '.article-content'
            ];
            
            let mainElement = null;
            
            for (const selector of contentSelectors) {
                mainElement = document.querySelector(selector);
                if (mainElement) break;
            }
            
            if (!mainElement) {
                mainElement = document.body;
            }
            
            // コンテンツのクリーニング
            const cleanedContent = this.cleanTextContent(mainElement);
            this.pageData.mainText = cleanedContent.substring(0, 2000); // 最初の2000文字
        }
        
        // テキストコンテンツのクリーニング
        cleanTextContent(element) {
            // 不要な要素を除去したクローンを作成
            const clone = element.cloneNode(true);
            
            // 不要な要素を削除
            const unwantedSelectors = [
                'script',
                'style',
                'nav',
                'header',
                'footer',
                '.navigation',
                '.nav',
                '.menu',
                '.sidebar',
                '.ad',
                '.advertisement',
                '.social',
                '.share',
                '.comment',
                '.comments'
            ];
            
            unwantedSelectors.forEach(selector => {
                const elements = clone.querySelectorAll(selector);
                elements.forEach(el => el.remove());
            });
            
            // テキストを取得してクリーニング
            let text = clone.textContent || '';
            
            // 余分な空白や改行を整理
            text = text.replace(/\s+/g, ' ').trim();
            
            return text;
        }
        
        // セマンティックコンテンツの抽出
        extractSemanticContent() {
            // 重要な画像の抽出
            this.extractImportantImages();
            
            // 重要なリンクの抽出
            this.extractImportantLinks();
        }
        
        // 重要な画像の抽出
        extractImportantImages() {
            const images = document.querySelectorAll('img');
            this.pageData.images = Array.from(images)
                .filter(img => img.src && img.alt)
                .map(img => ({
                    src: img.src,
                    alt: img.alt.trim(),
                    title: img.title || ''
                }))
                .filter(img => img.alt.length > 0)
                .slice(0, 5); // 最大5つの画像
        }
        
        // 重要なリンクの抽出
        extractImportantLinks() {
            const links = document.querySelectorAll('a[href]');
            this.pageData.links = Array.from(links)
                .filter(link => {
                    const text = link.textContent.trim();
                    const href = link.href;
                    return text.length > 0 && 
                           text.length < 100 && 
                           href.startsWith('http') &&
                           !href.includes('#') &&
                           text.toLowerCase() !== 'click here' &&
                           text.toLowerCase() !== 'read more';
                })
                .map(link => ({
                    href: link.href,
                    text: link.textContent.trim(),
                    title: link.title || ''
                }))
                .slice(0, 10); // 最大10つのリンク
        }
        
        // キーワードの抽出と分析
        extractKeywords(maxKeywords = 10) {
            const allText = [
                this.pageData.title,
                this.pageData.metaKeywords,
                this.pageData.metaDescription,
                this.pageData.headings.map(h => h.text).join(' '),
                this.pageData.mainText
            ].join(' ');
            
            return this.analyzeTextForKeywords(allText, maxKeywords);
        }
        
        // テキスト解析によるキーワード抽出
        analyzeTextForKeywords(text, maxKeywords) {
            if (!text) return [];
            
            const keywords = new Map();
            
            // 英数字キーワードの抽出
            const englishWords = text.match(/[a-zA-Z0-9]{3,20}/g) || [];
            englishWords.forEach(word => {
                const lowerWord = word.toLowerCase();
                if (!this.isStopWord(lowerWord)) {
                    keywords.set(lowerWord, (keywords.get(lowerWord) || 0) + 1);
                }
            });
            
            // 日本語キーワードの抽出
            const japaneseWords = [
                ...(text.match(/[ァ-ヶー]{2,15}/g) || []), // カタカナ
                ...(text.match(/[一-龯]{2,10}/g) || [])     // 漢字
            ];
            
            japaneseWords.forEach(word => {
                if (word.length >= 2 && word.length <= 15) {
                    keywords.set(word, (keywords.get(word) || 0) + 1);
                }
            });
            
            // 頻度順でソートして上位を返す
            return Array.from(keywords.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, maxKeywords)
                .map(([word]) => word);
        }
        
        // ストップワードの判定
        isStopWord(word) {
            const stopWords = new Set([
                'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for',
                'from', 'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on',
                'that', 'the', 'to', 'was', 'were', 'will', 'with', 'the',
                'this', 'but', 'they', 'have', 'had', 'what', 'said', 'each',
                'which', 'she', 'do', 'how', 'their', 'if', 'up', 'out', 'many',
                'then', 'them', 'these', 'so', 'some', 'her', 'would', 'make',
                'like', 'into', 'him', 'time', 'two', 'more', 'go', 'no', 'way',
                'could', 'my', 'than', 'first', 'been', 'call', 'who', 'oil',
                'sit', 'now', 'find', 'down', 'day', 'did', 'get', 'come', 'made',
                'may', 'part'
            ]);
            
            return stopWords.has(word) || word.length < 3;
        }
    }
    
    // グローバルに利用可能な関数として登録
    window.pageAnalyzer = new PageAnalyzer();
    
    // メッセージリスナーの設定
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'analyzePageContent') {
            try {
                const pageData = window.pageAnalyzer.analyze();
                const keywords = window.pageAnalyzer.extractKeywords(15);
                
                sendResponse({
                    success: true,
                    data: {
                        ...pageData,
                        keywords: keywords
                    }
                });
            } catch (error) {
                sendResponse({
                    success: false,
                    error: error.message
                });
            }
        }
        
        return true; // 非同期レスポンスを示す
    });
    
})();