import React, { useState, useCallback } from 'react';
import './App.css';
import Sidebar from './components/Sidebar/Sidebar.jsx';
import Canvas from './components/Canvas/Canvas.jsx';
import NodePropertiesPanel from './components/NodePropertiesPanel/NodePropertiesPanel.jsx';
import { NODE_CONFIG } from './constants/nodeTypes.jsx';

function App() {
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nextNodeId, setNextNodeId] = useState(1);

  const addNode = useCallback((type, position) => {
    const newNode = {
      id: nextNodeId,
      type,
      title: NODE_CONFIG[type].defaultTitle,
      description: '',
      position,
      items: [],
      tags: [],
      dependencies: []
    };
    setNodes(prev => [...prev, newNode]);
    setNextNodeId(prev => prev + 1);
    return newNode;
  }, [nextNodeId]);

  const updateNode = useCallback((nodeId, updates) => {
    setNodes(prev => prev.map(node => 
      node.id === nodeId ? { ...node, ...updates } : node
    ));
  }, []);

  const deleteNode = useCallback((nodeId) => {
    setNodes(prev => prev.filter(node => node.id !== nodeId));
    setConnections(prev => prev.filter(conn => 
      conn.from !== nodeId && conn.to !== nodeId
    ));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  }, [selectedNode]);

  const addConnection = useCallback((fromId, toId) => {
    setConnections(prev => {
      // Check if connection already exists
      const exists = prev.some(conn => conn.from === fromId && conn.to === toId);
      if (exists) return prev;
      return [...prev, { from: fromId, to: toId }];
    });
  }, []);

  const removeConnection = useCallback((fromId, toId) => {
    setConnections(prev => prev.filter(conn => 
      !(conn.from === fromId && conn.to === toId)
    ));
  }, []);

  const insertNodeBetween = useCallback((newNodeId, fromId, toId) => {
    setConnections(prev => {
      // Remove old connection
      const filtered = prev.filter(conn => 
        !(conn.from === fromId && conn.to === toId)
      );
      // Add two new connections
      return [
        ...filtered,
        { from: fromId, to: newNodeId },
        { from: newNodeId, to: toId }
      ];
    });
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">
          Puzz<span className="app-title-accent">Flow</span>
        </h1>
      </header>
      <div className="app-content">
        <Sidebar onNodeTypeSelect={addNode} />
        <Canvas
          nodes={nodes}
          connections={connections}
          selectedNode={selectedNode}
          onNodeSelect={setSelectedNode}
          onAddNode={addNode}
          onNodeMove={updateNode}
          onNodeDelete={deleteNode}
          onConnectionCreate={addConnection}
          onConnectionRemove={removeConnection}
          onInsertNodeBetween={insertNodeBetween}
        />
        <NodePropertiesPanel
          node={selectedNode}
          nodes={nodes}
          onUpdateNode={updateNode}
          onDeleteNode={deleteNode}
          connections={connections}
        />
      </div>
    </div>
  );
}

export default App;
