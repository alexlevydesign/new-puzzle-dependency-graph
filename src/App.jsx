import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  
  // History management for undo/redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoAction = useRef(false);

  // Save state to history whenever nodes or connections change
  useEffect(() => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }

    const currentState = {
      nodes,
      connections,
      nextNodeId,
      selectedNode
    };

    setHistory(prev => {
      // Remove any future history if we're not at the end
      const newHistory = prev.slice(0, historyIndex + 1);
      // Add current state
      newHistory.push(currentState);
      // Limit history to 50 states to prevent memory issues
      if (newHistory.length > 50) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });

    setHistoryIndex(prev => {
      const newIndex = prev + 1;
      return newIndex >= 50 ? 49 : newIndex;
    });
  }, [nodes, connections, nextNodeId, selectedNode]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;

    isUndoRedoAction.current = true;
    const prevState = history[historyIndex - 1];
    setNodes(prevState.nodes);
    setConnections(prevState.connections);
    setNextNodeId(prevState.nextNodeId);
    setSelectedNode(prevState.selectedNode);
    setHistoryIndex(prev => prev - 1);
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;

    isUndoRedoAction.current = true;
    const nextState = history[historyIndex + 1];
    setNodes(nextState.nodes);
    setConnections(nextState.connections);
    setNextNodeId(nextState.nextNodeId);
    setSelectedNode(nextState.selectedNode);
    setHistoryIndex(prev => prev + 1);
  }, [history, historyIndex]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check if user is typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // Cmd+Z (Mac) or Ctrl+Z (Windows/Linux) for undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Cmd+Shift+Z (Mac) or Ctrl+Shift+Z (Windows/Linux) for redo
      else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        redo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

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
        <Sidebar 
          onNodeTypeSelect={addNode}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
        />
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
