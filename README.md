# PuzzFlow - Puzzle Dependency Graph Creator

A visual tool for planning and organizing puzzle dependencies in point-and-click adventure games.

## Features

- **Node Types**: Six different node types for organizing game logic
  - Player Action
  - Character Action
  - Get Item
  - Use Item
  - Goal
  - Story State

- **Visual Flow**: Connect nodes to show puzzle dependencies and game flow

- **Node Insertion**: Drag nodes between connected nodes to automatically insert them into the flow

- **Node Disconnection**: Hold Command (⌘) or Ctrl and drag a node to disconnect it from incoming connections

- **Node Properties**: Edit titles, descriptions, items, tags, and view dependencies for each node

## Getting Started

### Installation

```bash
npm install
```

### Running the Application

```bash
npm start
```

The application will open at [http://localhost:3000](http://localhost:3000)

### Building for Production

```bash
npm run build
```

## How to Use

1. **Add Nodes**: Drag node types from the left sidebar onto the canvas
2. **Connect Nodes**: Click and drag from the bottom connection point of one node to the top of another
3. **Move Nodes**: Click and drag nodes to reposition them
4. **Insert Nodes**: Drag a new node over an existing connection line (it will highlight green) to insert it between two nodes
5. **Disconnect Nodes**: Hold Command/Ctrl and drag a node to remove its incoming connections
6. **Edit Properties**: Click a node to select it and edit its properties in the right panel
7. **Delete Nodes**: Select a node and click the trash icon in the properties panel

## Project Structure

```
src/
├── components/
│   ├── Canvas/
│   │   ├── Canvas.js
│   │   ├── Canvas.css
│   │   ├── GraphNode.js
│   │   ├── GraphNode.css
│   │   ├── ConnectionLine.js
│   │   └── ConnectionLine.css
│   ├── Sidebar/
│   │   ├── Sidebar.js
│   │   ├── Sidebar.css
│   │   ├── NodeTypeButton.js
│   │   └── NodeTypeButton.css
│   └── NodePropertiesPanel/
│       ├── NodePropertiesPanel.js
│       └── NodePropertiesPanel.css
├── constants/
│   └── nodeTypes.js
├── App.js
├── App.css
├── index.js
└── index.css
```

## Technologies

- React 18
- CSS3 (no frameworks)
- SVG for connection lines
