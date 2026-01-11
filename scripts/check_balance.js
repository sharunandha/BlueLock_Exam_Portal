import fs from 'fs';
const s = fs.readFileSync('server.js','utf8');
const counts = {
  backtick: (s.match(/`/g)||[]).length,
  single: (s.match(/'/g)||[]).length,
  double: (s.match(/"/g)||[]).length,
  openParen: (s.match(/\(/g)||[]).length,
  closeParen: (s.match(/\)/g)||[]).length,
  openBrace: (s.match(/{/g)||[]).length,
  closeBrace: (s.match(/}/g)||[]).length,
  openBracket: (s.match(/\[/g)||[]).length,
  closeBracket: (s.match(/\]/g)||[]).length
};
console.log(counts);
// find lines with backticks and show context
const lines = s.split('\n');
let bal = 0;
lines.forEach((l, i) => {
  if (l.includes('[') || l.includes(']')) {
    const opens = (l.match(/\[/g)||[]).length;
    const closes = (l.match(/\]/g)||[]).length;
    bal += opens - closes;
    console.log((i+1)+':', 'opens', opens, 'closes', closes, 'bal->', bal, '|', l);
  }
});
console.log('Final square bracket balance:', bal);
