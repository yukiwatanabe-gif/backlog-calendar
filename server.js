const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3456;

function proxyBacklog(req, res, parsedUrl) {
  const params = new URLSearchParams(parsedUrl.query);
  const spaceUrl = params.get('_space');
  const apiPath = params.get('_path');
  if (!spaceUrl || !apiPath) {
    res.writeHead(400);
    res.end('Missing _space or _path');
    return;
  }
  params.delete('_space');
  params.delete('_path');

  const targetUrl = `https://${spaceUrl}/api/v2${apiPath}?${params.toString()}`;

  https.get(targetUrl, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    proxyRes.pipe(res);
  }).on('error', (e) => {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);

  // CORSプリフライト
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' });
    res.end();
    return;
  }

  // サーバー設定を返す
  if (parsedUrl.pathname === '/config') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({
      spaceUrl:      process.env.BACKLOG_SPACE_URL   || '',
      apiKey:        process.env.BACKLOG_API_KEY     || '',
      projectKeys:   process.env.BACKLOG_PROJECT_KEY || '',
      timeFieldName: process.env.BACKLOG_TIME_FIELD  || '',
    }));
    return;
  }

  // Backlog APIプロキシ
  if (parsedUrl.pathname === '/proxy') {
    proxyBacklog(req, res, parsedUrl);
    return;
  }

  // 静的ファイル配信
  let filePath = path.join(__dirname, parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname);
  const ext = path.extname(filePath);
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Backlogカレンダー起動中: http://localhost:${PORT}`);
  console.log('   停止するには Ctrl+C');

  // ブラウザを自動で開く（Windowsのみ）
  if (process.platform === 'win32') {
    const { exec } = require('child_process');
    exec(`start http://localhost:${PORT}`);
  }
});
