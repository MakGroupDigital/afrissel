const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir('./src', (filePath) => {
    if (filePath.endsWith('.tsx')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let newContent = content
            .replace(/#FF6B00/g, '#15EA3E')
            .replace(/#00F0FF/g, '#FFFFFF')
            .replace(/#FF9E00/g, '#12C233')
            .replace(/#ff7b1a/g, '#1ee844')
            .replace(/#D4AF37/g, '#FFFFFF');
            
        if (content !== newContent) {
            fs.writeFileSync(filePath, newContent);
            console.log(`Updated ${filePath}`);
        }
    }
});
