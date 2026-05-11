import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir('./src', (filePath) => {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let newContent = content.replace(/rgba\(255,107,0/g, 'rgba(21,234,62');
            
        if (content !== newContent) {
            fs.writeFileSync(filePath, newContent);
            console.log(`Updated rgba shadow in ${filePath}`);
        }
    }
});
