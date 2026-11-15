# File Tree: chatbot

**Generated:** 11/14/2026, 8:46:34 AM
**Root Path:** `/home/khiem/chatbot`

```
├── 📁 be
│   ├── 📁 ai
│   │   ├── 📁 app
│   │   │   ├── 📁 agents
│   │   │   │   ├── 🐍 __init__.py
│   │   │   │   ├── 🐍 base.py
│   │   │   │   ├── 🐍 developer.py
│   │   │   │   ├── 🐍 interviewer.py
│   │   │   │   ├── 🐍 planner.py
│   │   │   │   └── 🐍 tester.py
│   │   │   ├── 📁 skills
│   │   │   │   ├── 📁 design
│   │   │   │   │   ├── ⚙️ coffee_warm.yaml
│   │   │   │   │   ├── ⚙️ minimal.yaml
│   │   │   │   │   ├── ⚙️ tech_neon.yaml
│   │   │   │   │   └── ⚙️ vibrant.yaml
│   │   │   │   ├── 🐍 __init__.py
│   │   │   │   └── 🐍 registry.py
│   │   │   ├── 📁 templates
│   │   │   │   └── 📁 ecommerce_basic
│   │   │   │       ├── 📁 files
│   │   │   │       │   ├── 📁 api
│   │   │   │       │   │   ├── 📁 middlewares
│   │   │   │       │   │   │   ├── 📄 auth.js
│   │   │   │       │   │   │   ├── 📄 errorHandler.js
│   │   │   │       │   │   │   └── 📄 role.js
│   │   │   │       │   │   ├── 📁 routes
│   │   │   │       │   │   │   ├── 📁 custom
│   │   │   │       │   │   │   │   └── ⚙️ .gitkeep
│   │   │   │       │   │   │   ├── 📄 auth.js
│   │   │   │       │   │   │   ├── 📄 cart.js
│   │   │   │       │   │   │   ├── 📄 categories.js
│   │   │   │       │   │   │   ├── 📄 orders.js
│   │   │   │       │   │   │   ├── 📄 payments.js
│   │   │   │       │   │   │   └── 📄 products.js
│   │   │   │       │   │   ├── 🐳 Dockerfile
│   │   │   │       │   │   ├── 📄 app.js
│   │   │   │       │   │   ├── 📄 db.js
│   │   │   │       │   │   ├── ⚙️ package.json
│   │   │   │       │   │   └── 📄 server.js
│   │   │   │       │   ├── 📁 db
│   │   │   │       │   │   ├── 📄 01_init.sql
│   │   │   │       │   │   ├── 📄 02_extra.sql
│   │   │   │       │   │   ├── 📄 03_seed.sql
│   │   │   │       │   │   └── 🐳 Dockerfile
│   │   │   │       │   ├── 📁 web
│   │   │   │       │   │   ├── 📁 src
│   │   │   │       │   │   │   ├── 📁 api
│   │   │   │       │   │   │   │   └── 📄 client.js
│   │   │   │       │   │   │   ├── 📁 components
│   │   │   │       │   │   │   │   ├── 📄 Footer.jsx
│   │   │   │       │   │   │   │   ├── 📄 Header.jsx
│   │   │   │       │   │   │   │   └── 📄 ProductCard.jsx
│   │   │   │       │   │   │   ├── 📁 context
│   │   │   │       │   │   │   │   ├── 📄 AuthContext.jsx
│   │   │   │       │   │   │   │   └── 📄 CartContext.jsx
│   │   │   │       │   │   │   ├── 📁 custom
│   │   │   │       │   │   │   │   └── ⚙️ .gitkeep
│   │   │   │       │   │   │   ├── 📁 pages
│   │   │   │       │   │   │   │   ├── 📁 admin
│   │   │   │       │   │   │   │   │   ├── 📄 Dashboard.jsx
│   │   │   │       │   │   │   │   │   ├── 📄 OrderManage.jsx
│   │   │   │       │   │   │   │   │   └── 📄 ProductManage.jsx
│   │   │   │       │   │   │   │   ├── 📄 Cart.jsx
│   │   │   │       │   │   │   │   ├── 📄 Checkout.jsx
│   │   │   │       │   │   │   │   ├── 📄 Home.jsx
│   │   │   │       │   │   │   │   ├── 📄 Login.jsx
│   │   │   │       │   │   │   │   ├── 📄 ProductDetail.jsx
│   │   │   │       │   │   │   │   └── 📄 ProductList.jsx
│   │   │   │       │   │   │   ├── 📁 theme
│   │   │   │       │   │   │   │   ├── 🎨 theme.css
│   │   │   │       │   │   │   │   └── ⚙️ tokens.json
│   │   │   │       │   │   │   ├── 📄 App.jsx
│   │   │   │       │   │   │   └── 📄 main.jsx
│   │   │   │       │   │   ├── 🐳 Dockerfile
│   │   │   │       │   │   ├── 🌐 index.html
│   │   │   │       │   │   ├── ⚙️ nginx.conf
│   │   │   │       │   │   ├── ⚙️ package.json
│   │   │   │       │   │   └── 📄 vite.config.js
│   │   │   │       │   └── ⚙️ docker-compose.yml
│   │   │   │       ├── ⚙️ manifest.yaml
│   │   │   │       └── ⚙️ skill_bindings.yaml
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 config.py
│   │   │   ├── 🐍 context.py
│   │   │   ├── 🐍 llm.py
│   │   │   ├── 🐍 main.py
│   │   │   ├── 🐍 orchestrator.py
│   │   │   ├── 🐍 schemas.py
│   │   │   ├── 🐍 tools.py
│   │   │   └── 🐍 validator.py
│   │   ├── 🐳 Dockerfile
│   │   └── 📄 requirements.txt
│   └── 📁 data-service
│       ├── 📁 database
│       │   ├── 📄 init.sql
│       │   └── 📄 seed.sql
│       ├── 📁 middlewares
│       │   ├── 📄 auth.js
│       │   ├── 📄 errorHandler.js
│       │   ├── 📄 internal.js
│       │   └── 📄 role.js
│       ├── 📁 models
│       │   ├── 📄 conversationModel.js
│       │   ├── 📄 runModel.js
│       │   ├── 📄 specModel.js
│       │   └── 📄 userModel.js
│       ├── 📁 routes
│       │   ├── 📄 auth.js
│       │   ├── 📄 conversations.js
│       │   ├── 📄 generate.js
│       │   ├── 📄 internal.js
│       │   ├── 📄 runs.js
│       │   ├── 📄 specs.js
│       │   └── 📄 templates.js
│       ├── 📁 services
│       │   └── 📄 previewManager.js
│       ├── 📁 utils
│       │   └── 📄 response.js
│       ├── 🐳 Dockerfile
│       ├── 📄 app.js
│       ├── 📄 db.js
│       ├── ⚙️ package.json
│       └── 📄 server.js
├── 📁 fe
│   ├── 📁 public
│   │   └── 🖼️ bot_icon.jpg
│   ├── 📁 src
│   │   ├── 📁 api
│   │   │   └── 📄 client.js
│   │   ├── 📁 assets
│   │   │   └── 📁 icons
│   │   ├── 📁 components
│   │   │   ├── 📄 ChatBox.jsx
│   │   │   ├── 📄 FileTree.jsx
│   │   │   ├── 📄 Header.jsx
│   │   │   ├── 📄 PreviewFrame.jsx
│   │   │   ├── 📄 ProgressBar.jsx
│   │   │   └── 📄 SpecEditor.jsx
│   │   ├── 📁 pages
│   │   │   ├── 📄 ChatPage.jsx
│   │   │   ├── 📄 HistoryPage.jsx
│   │   │   ├── 📄 LoginPage.jsx
│   │   │   └── 📄 RunDetailPage.jsx
│   │   ├── 📄 App.jsx
│   │   ├── 📄 main.jsx
│   │   └── 🎨 styles.css
│   ├── 🐳 Dockerfile
│   ├── 🌐 index.html
│   ├── ⚙️ nginx.conf
│   ├── ⚙️ package.json
│   └── 📄 vite.config.js
├── 📁 outputs
├── ⚙️ .env.example
├── ⚙️ .gitignore
├── 📝 HUONG_DAN.md
├── 📝 README.md
└── ⚙️ docker-compose.yml
```

---
*Generated by FileTree Pro Extension*