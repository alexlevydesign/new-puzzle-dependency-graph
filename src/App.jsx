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

  const exportData = useCallback(() => {
    const data = {
      nodes,
      connections,
      nextNodeId,
      version: '1.0',
      exportDate: new Date().toISOString()
    };
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `puzzflow-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [nodes, connections, nextNodeId]);

  const importData = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          
          // Validate data structure
          if (data.nodes && data.connections && data.nextNodeId) {
            setNodes(data.nodes);
            setConnections(data.connections);
            setNextNodeId(data.nextNodeId);
            setSelectedNode(null);
            alert('Successfully imported puzzle flow!');
          } else {
            alert('Invalid file format. Please select a valid PuzzFlow export file.');
          }
        } catch (error) {
          alert('Error reading file. Please make sure it\'s a valid JSON file.');
          console.error('Import error:', error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">
          Puzz<span className="app-title-accent">Flow</span>
        </h1>
        <div className="app-header-actions">
          <button className="header-button" onClick={importData} title="Import project">
            <img src="/icons/upload.svg" alt="Import" />
            <span>Import</span>
          </button>
          <button className="header-button" onClick={exportData} title="Export project">
            <img src="/icons/download.svg" alt="Export" />
            <span>Export</span>
          </button>
        </div>
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
