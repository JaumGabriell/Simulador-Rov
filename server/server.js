// ═══════════════════════════════════════════════════════════════════════════
// ALPHA SUBSEA - ROV SIMULATOR SERVER
// Servidor HTTP simples para desenvolvimento
// ═══════════════════════════════════════════════════════════════════════════

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8091;
const ROOT_DIR = path.join(__dirname, "..");

// Mapeamento de extensões para MIME types
const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".stl": "application/octet-stream",
  ".obj": "text/plain",
  ".mtl": "text/plain",
  ".gltf": "model/gltf+json",
  ".glb": "model/gltf-binary",
  ".fbx": "application/octet-stream",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

const server = http.createServer((req, res) => {
  // Log da requisição
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // Normalizar URL
  let filePath = req.url.split("?")[0]; // Remover query string

  // Redirecionar raiz para index.html
  if (filePath === "/") {
    filePath = "/index.html";
  }

  // Construir caminho completo
  const fullPath = path.join(ROOT_DIR, filePath);

  // Verificar se o arquivo existe
  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Arquivo não encontrado
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>404 - Not Found</title></head>
        <body style="background:#0a0e14;color:#00ff88;font-family:monospace;padding:40px;">
          <h1>404 - Arquivo não encontrado</h1>
          <p>O arquivo <code>${filePath}</code> não existe.</p>
          <a href="/" style="color:#00aaff;">← Voltar ao início</a>
        </body>
        </html>
      `);
      return;
    }

    // Determinar MIME type
    const ext = path.extname(fullPath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || "application/octet-stream";

    // Ler e enviar arquivo
    fs.readFile(fullPath, (err, data) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Erro interno do servidor");
        return;
      }

      // Headers de resposta
      res.writeHead(200, {
        "Content-Type": mimeType,
        "Content-Length": data.length,
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(data);
    });
  });
});

server.listen(PORT, () => {
  console.log("");
  console.log(
    "═══════════════════════════════════════════════════════════════"
  );
  console.log("  ALPHA SUBSEA - ROV SIMULATOR SERVER");
  console.log(
    "═══════════════════════════════════════════════════════════════"
  );
  console.log("");
  console.log(`  🚀 Servidor rodando em: http://localhost:${PORT}`);
  console.log("");
  console.log("  Páginas disponíveis:");
  console.log(
    `    • http://localhost:${PORT}/              - Seleção de Cenários`
  );
  console.log(`    • http://localhost:${PORT}/gerenciador.html - Gerenciador`);
  console.log(
    `    • http://localhost:${PORT}/simulator.html?scenario=training_arena - Modular`
  );
  console.log(
    `    • http://localhost:${PORT}/rov_simulator_pro.html - Monolítico (backup)`
  );
  console.log("");
  console.log("  Pressione Ctrl+C para parar o servidor");
  console.log(
    "═══════════════════════════════════════════════════════════════"
  );
  console.log("");
});

// Tratamento de erros
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Porta ${PORT} já está em uso!`);
    console.error(`   Tente: PORT=8091 node server/server.js`);
  } else {
    console.error("❌ Erro no servidor:", err);
  }
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n👋 Servidor encerrado.");
  process.exit(0);
});
