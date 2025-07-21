const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function convertSvgToPng() {
    try {
        const baseDir = '/git/smart-url-shortcut-generator-icons';
        const svgPath = path.join(baseDir, 'icons', 'icon.svg');
        const svgContent = fs.readFileSync(svgPath);

        console.log('SVGファイルを読み込みました:', svgPath);

        // 必要なサイズ
        const sizes = [16, 48, 128];

        for (const size of sizes) {
            const outputPath = path.join(baseDir, 'icons', `icon${size}.png`);
            
            await sharp(svgContent)
                .resize(size, size)
                .png()
                .toFile(outputPath);
            
            console.log(`✓ ${size}x${size} PNG作成完了: ${outputPath}`);
        }

        console.log('\n✅ 全てのPNGファイルの変換が完了しました！');
        
        // 作成されたファイルのサイズを確認
        console.log('\n📊 作成されたファイル一覧:');
        for (const size of sizes) {
            const filePath = path.join(baseDir, 'icons', `icon${size}.png`);
            const stats = fs.statSync(filePath);
            console.log(`- icon${size}.png: ${stats.size} bytes`);
        }

    } catch (error) {
        console.error('❌ エラーが発生しました:', error);
        throw error;
    }
}

// スクリプト実行
convertSvgToPng().catch(console.error);