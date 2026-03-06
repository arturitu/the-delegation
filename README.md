# The Delegation

### What if you could stop prompting & start delegating to a team of AI agents in a living 3D office?

**The Delegation** is a high-performance 3D simulation built with **Three.js WebGPU** where autonomous LLM-powered characters collaborate in a shared physical workspace.

Unlike traditional "chat-only" agent frameworks, these characters are _embodied_: they navigate a 3D environment, claim workstations, express emotions through animations, and interact with the user and each other to fulfill complex project briefs.

![The Delegation Hero](public/images/the-delegation-UI.png)

## Online Demo

**Try the Live Demo: [arturitu.github.io/the-delegation](https://arturitu.github.io/the-delegation/)**

This simulation requires **BYOK (Bring Your Own Key)**. Currently, it only supports the **Gemini API** by Google. Multi-provider support is planned for future updates.

## Getting Started

1. **Install dependencies:**

```bash
npm install
```

2. **Run the development server:**

```bash
npm run dev
```

3. **Open the app:** Navigate to the local URL shown in your terminal (usually `http://localhost:3000`).

## Features

### Advanced Agency System

- **Orchestrated Workflow:** A specialized agency service manages the project lifecycle from initial briefing to final delivery.
- **Autonomous Task Management:** Agents propose their own tasks, request client approval when stuck, and update a real-time Kanban board.
- **Tool-Augmented Intelligence:** Deep integration with LLM function calling, allowing agents to "act" (e.g., `propose_task`, `request_approval`) within the simulation.

### Embodied Simulation

- **Hybrid GPU/CPU Architecture:** High-efficiency character instancing using WebGPU Compute Shaders.
- **Intelligent Pathfinding:** NPCs utilize a NavMesh to navigate the office, finding and claiming specific "Points of Interest" (desks, seats, computers) based on their current task. Pathfinding is powered by [three-pathfinding](https://github.com/donmccurdy/three-pathfinding).
- **Dynamic State Machine:** Characters transition naturally between walking, sitting, working, and talking, with sync'ed 3D speech bubbles and expressions.

### Interactive UI

- **Real-time 3D Overlay:** Status indicators and interaction menus projected from 3D space into a polished React UI.
- **Agent Inspector:** Select any agent to view their current "thoughts", mission, and history.
- **Kanban & Action Logs:** Complete transparency into the agency's progress and the "hidden" tool calls made by the LLMs.

## Tech Stack Deep Dive

- **Engine:** [Three.js](https://threejs.org/) (WebGPU & TSL) for advanced rendering and compute.
- **UI:** [React](https://react.dev/) for a modern, component-based interface.
- **AI:** [Gemini API](https://deepmind.google/technologies/gemini/) (BYOK: Bring Your Own Key) is the current LLM provider. The architecture is designed for future multi-provider support (see Roadmap).
- **State:** [Zustand](https://github.com/pmndrs/zustand) for a unified, reactive store bridging the 3D world and React UI.
- **3D Assets:** All modeling and animation were done in Blender, exported to glTF for efficient use with Three.js. The animation system uses a custom state machine to handle instanced GLTF character animations.

## Roadmap

My goal is to move towards a fully sandboxable agency experience:

- **Intelligence**
  - [ ] **Multi-Model Support:** Integration for OpenAI, Anthropic, and local Ollama models.
  - [ ] **Per-Agent LLM:** Assign different models/providers to specific roles.
  - [ ] **Custom Teams:** Create your own expert sets with unique personalities and missions via UI.
- **Creative Outputs**
  - [ ] **Rich Deliverables:** Final project output including generated images, videos, code snippets, or synthesized music.
- **World Building**
  - [ ] **Office/3D Space Editor:** Drag-and-drop editor to customize the workspace layout and POIs.

## Supporting the Project

The Delegation is an experiment in the future of human-AI collaboration. If you find this project inspiring or useful for your own research, consider supporting my work:

[![Sponsor GitHub](https://img.shields.io/badge/Sponsor-GitHub-ea4aaa?logo=github)](https://github.com/sponsors/arturitu)

## License & IP

This project follows a dual-licensing model:

- **Source Code (MIT):** All logic, shaders, and UI code are free to use, modify, and distribute.
- **3D Models & Assets (CC BY-NC 4.0):** The custom 3D office and character models are Copyright © 2026 **Arturo Paracuellos (unboring.net)**. They are free for personal and educational use but _cannot_ be used for commercial purposes without permission.

Developed with ❤️ by [Arturo Paracuellos](https://unboring.net)
