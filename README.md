# Alpha Subsea - ROV Professional Training Simulator v3.0

Simulador profissional de ROV (Remotely Operated Vehicle) para treinamento de pilotos em operações submarinas.

## 📁 Estrutura do Projeto

```
simulador-rov/
├── server/
│   └── server.js              # Servidor Node.js para desenvolvimento
├── src/
│   ├── css/
│   │   └── simulator.css      # Estilos do simulador (HUD industrial)
│   ├── js/
│   │   ├── scenarios/
│   │   │   ├── index.js           # Índice de todos os cenários
│   │   │   ├── inspection/        # Cenários de inspeção
│   │   │   │   ├── hull-inspection.js
│   │   │   │   └── pipeline-inspection.js
│   │   │   ├── skill/             # Cenários de habilidade
│   │   │   │   └── training-scenarios.js
│   │   │   └── emergency/         # Cenários de emergência
│   │   │       └── emergency-scenarios.js
│   │   ├── core/              # (futuro) Classes principais
│   │   ├── environments/      # (futuro) Criação de ambientes 3D
│   │   └── loaders/           # (futuro) Carregadores de modelos
│   └── html/                  # (futuro) Templates HTML
├── models/                    # Modelos 3D (STL, OBJ, GLTF)
├── index.html                 # Seleção de cenários
├── gerenciador.html           # Gerenciador de cenários
├── rov_simulator_pro.html     # Simulador principal
├── package.json               # Configuração do projeto
└── README.md                  # Este arquivo
```

## 🚀 Como Executar

### Opção 1: Servidor Node.js (Recomendado)

```bash
# Instalar dependências (não há nenhuma externa)
npm install

# Iniciar servidor na porta 8090
npm start

# Ou especificar outra porta
PORT=3000 npm start
```

### Opção 2: Python HTTP Server

```bash
python3 -m http.server 8090
```

### Opção 3: Abrir diretamente no navegador

Abra o arquivo `index.html` diretamente no navegador (algumas funcionalidades podem não funcionar).

## 🎮 Controles

### Teclado

| Tecla | Ação                        |
| ----- | --------------------------- |
| W/S   | Frente/Trás                 |
| A/D   | Esquerda/Direita            |
| Q/E   | Subir/Descer                |
| ←/→   | Rotação (Yaw)               |
| ↑/↓   | Pitch da câmera             |
| Shift | Aumentar velocidade         |
| Ctrl  | Diminuir velocidade         |
| L     | Ligar/Desligar luzes        |
| +/-   | Intensidade das luzes       |
| C     | Trocar câmera               |
| P     | Pausar                      |
| R     | Anexar/Soltar ROV (resgate) |

### Gamepad (Xbox/PlayStation)

- **Analógico Esquerdo**: Movimento horizontal
- **Analógico Direito**: Rotação e pitch
- **Gatilhos**: Subir/Descer
- **L1/R1**: Ajustar velocidade
- **X/A**: Ligar luzes
- **Y/△**: Trocar câmera

## 📋 Categorias de Cenários

### 🔍 Inspeção

- Inspeção de Casco FPSO
- Inspeção de Jaqueta
- Survey de Pipeline
- Inspeção de Tanque
- Inspeção de Umbilical

### 🎯 Habilidade

- Treinamento Básico
- Circuito de Obstáculos
- Operação Águas Turvas
- Recuperação de Ferramenta
- Resgate de Mini-ROVs

### 🚨 Emergência

- Emergência - Vazamento
- Instalação de ANM
- Conexão de Jumper
- Suporte Mergulho SAT
- Emergência Múltipla
- Desafio Final

## 🛠️ Tecnologias

- **Three.js r128** - Renderização 3D
- **JavaScript ES6+** - Lógica do simulador
- **CSS3** - Interface HUD industrial
- **Node.js** - Servidor de desenvolvimento

## 📝 Notas de Desenvolvimento

### Arquivos Extraídos (Módulos ES6)

1. ✅ **CSS** → `src/css/simulator.css` (~1200 linhas)
2. ✅ **Cenários** → `src/js/scenarios/`
   - `index.js` - Índice e utilitários
   - `inspection/` - Cenários de inspeção
   - `skill/` - Cenários de habilidade
   - `emergency/` - Cenários de emergência
3. ✅ **Core** → `src/js/core/`
   - `ROVSimulator.js` - Classe principal
   - `physics.js` - Sistema de física
   - `controls.js` - Teclado e gamepad
   - `hud.js` - Interface HUD
4. ✅ **Ambientes** → `src/js/environments/`
   - `EnvironmentFactory.js` - Fábrica de ambientes 3D
5. ✅ **Loaders** → `src/js/loaders/`
   - `model-loader.js` - Carregador STL/OBJ

### Arquivo Original

O arquivo `rov_simulator_pro.html` permanece funcional e contém o código completo.
Os módulos extraídos podem ser usados para criar uma versão modular futura.

## 📄 Licença

MIT License - Alpha Subsea
