import React, { useState, useCallback, useEffect, useRef } from 'react';
import './App.css';
import Canvas from './components/Canvas/Canvas.jsx';
import NodePropertiesPanel from './components/NodePropertiesPanel/NodePropertiesPanel.jsx';
import { NODE_CONFIG } from './constants/nodeTypes.jsx';

// ── Example graph: point-and-click game intro ──────────────────────────────
const EXAMPLE_STATE = {
  nodes: [
    { id: 1,  type: 'GOAL',            title: 'Escape the locked room',      description: 'The player must find a way out of the room they woke up in.',                                               position: { x: 360, y: 60   }, items: [], tags: [], dependencies: [] },
    { id: 2,  type: 'STORY_STATE',     title: 'Wake up in a dark room',      description: 'The game begins. The player is disoriented and the door is locked.',                                       position: { x: 360, y: 260  }, items: [], tags: [], dependencies: [] },
    { id: 3,  type: 'PLAYER_ACTION',   title: 'Look around the room',        description: 'Player examines the surroundings and notices a desk, a locked door, and a faint light under a drawer.',   position: { x: 360, y: 460  }, items: [], tags: [], dependencies: [] },
    { id: 4,  type: 'GET_ITEM',        title: 'Pick up the rusty key',       description: 'Hidden under the drawer lining. Only visible after examining the room.',                                   position: { x: 80,  y: 660  }, items: [], tags: [], dependencies: [] },
    { id: 5,  type: 'GET_ITEM',        title: 'Find the crumpled note',      description: 'On the desk. Says "the third drawer sticks — push, don\'t pull."',                                        position: { x: 360, y: 660  }, items: [], tags: [], dependencies: [] },
    { id: 6,  type: 'CHARACTER_ACTION',title: 'Voice from behind the door',  description: '"You\'re awake. You have ten minutes." Hints at an outside presence.',                                    position: { x: 640, y: 660  }, items: [], tags: [], dependencies: [] },
    { id: 7,  type: 'USE_ITEM',        title: 'Try key on locked door',      description: 'The rusty key fits but the lock is jammed. Player must find a way to free it.',                           position: { x: 80,  y: 880  }, items: [], tags: [], dependencies: [] },
    { id: 8,  type: 'STORY_STATE',     title: 'Third drawer opens',          description: "Following the note's hint reveals a hidden compartment inside the drawer.",                                position: { x: 360, y: 880  }, items: [], tags: [], dependencies: [] },
    { id: 9,  type: 'GET_ITEM',        title: 'Grab the oil can',            description: 'Inside the hidden compartment. Needed to free the jammed lock.',                                          position: { x: 360, y: 1100 }, items: [], tags: [], dependencies: [] },
    { id: 10, type: 'USE_ITEM',        title: 'Oil the lock, turn the key',  description: 'Combines the rusty key with the oil can. The door clicks open.',                                          position: { x: 220, y: 1320 }, items: [], tags: [], dependencies: [] },
    { id: 11, type: 'STORY_STATE',     title: 'Door swings open',            description: 'The player steps into a dimly lit corridor. The intro ends.',                                             position: { x: 220, y: 1540 }, items: [], tags: [], dependencies: [] },
  ],
  connections: [
    { from: 1, to: 2  },
    { from: 2, to: 3  },
    { from: 3, to: 4  },
    { from: 3, to: 5  },
    { from: 3, to: 6  },
    { from: 4, to: 7  },
    { from: 5, to: 8  },
    { from: 8, to: 9  },
    { from: 7, to: 10 },
    { from: 9, to: 10 },
    { from: 10, to: 11 },
  ],
  nextNodeId: 12
};

function App() {
  // Load initial state from localStorage
  const loadFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem('puzzflow-state');
      if (saved) {
        const data = JSON.parse(saved);
        return {
          nodes: data.nodes || [],
          connections: data.connections || [],
          nextNodeId: data.nextNodeId || 1
        };
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
    return EXAMPLE_STATE;
  };

  const initialState = loadFromLocalStorage();
  
  const [nodes, setNodes] = useState(initialState.nodes);
  const [connections, setConnections] = useState(initialState.connections);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nextNodeId, setNextNodeId] = useState(initialState.nextNodeId);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  
  // History management for undo/redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoAction = useRef(false);

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      const state = {
        nodes,
        connections,
        nextNodeId,
        version: '1.0',
        lastSaved: new Date().toISOString()
      };
      localStorage.setItem('puzzflow-state', JSON.stringify(state));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [nodes, connections, nextNodeId]);

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

  // Shift nodes downstream of a new node to restore consistent spacing.
  // excludeIds: node IDs that must never be moved.
  // thresholdY / newNodeBottom: vertical shift — only nodes at >= thresholdY that
  //   overlap with newNodeBottom get pushed down by the overlap amount.
  // columnX / columnTolerance: restrict vertical shift to a single X column.
  // thresholdX / deltaX: shift nodes whose X >= thresholdX right by deltaX.
  // maxX / leftDeltaX: shift nodes whose X <= maxX left by leftDeltaX.
  const shiftNodes = useCallback((
    excludeIds,
    thresholdY,
    newNodeBottom,
    thresholdX = null,
    deltaX = 0,
    columnX = null,
    columnTolerance = 150,
    maxX = null,
    leftDeltaX = 0
  ) => {
    setNodes(prev => prev.map(node => {
      if (excludeIds.includes(node.id)) return node;

      // Column constraint for vertical shifts
      if (columnX !== null && Math.abs(node.position.x - columnX) > columnTolerance) {
        return node;
      }

      let shiftY = 0;
      if (thresholdY !== null && node.position.y >= thresholdY) {
        const overlap = newNodeBottom - node.position.y;
        if (overlap > 0) shiftY = overlap;
      }

      // Rightward shift: nodes at or beyond thresholdX
      let shiftX = thresholdX !== null && node.position.x >= thresholdX ? deltaX : 0;
      // Leftward shift: nodes at or before maxX
      if (maxX !== null && node.position.x <= maxX) shiftX = leftDeltaX;

      if (shiftY === 0 && shiftX === 0) return node;
      return { ...node, position: { x: node.position.x + shiftX, y: node.position.y + shiftY } };
    }));
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
            // State will auto-save to localStorage via useEffect
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

  const clearCanvas = useCallback(() => {
    if (nodes.length === 0 && connections.length === 0) {
      return;
    }
    
    if (window.confirm('Are you sure you want to clear the entire canvas? This cannot be undone.')) {
      setNodes([]);
      setConnections([]);
      setNextNodeId(1);
      setSelectedNode(null);
      // Clear localStorage
      localStorage.removeItem('puzzflow-state');
    }
  }, [nodes.length, connections.length]);

  const loadExample = useCallback(() => {
    if (nodes.length > 0 || connections.length > 0) {
      if (!window.confirm('Load the example? This will replace your current canvas.')) return;
    }
    setNodes(EXAMPLE_STATE.nodes);
    setConnections(EXAMPLE_STATE.connections);
    setNextNodeId(EXAMPLE_STATE.nextNodeId);
    setSelectedNode(null);
  }, [nodes.length, connections.length]);

  // Close options menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showOptionsMenu && !e.target.closest('.options-menu-container')) {
        setShowOptionsMenu(false);
      }
    };

    if (showOptionsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showOptionsMenu]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-left">
          <h1 className="app-title">
            Puzz<span className="app-title-accent">Flow</span>
          </h1>
          <div className="app-header-actions">
            <button 
              className="header-button header-icon-button" 
              onClick={undo} 
              disabled={!canUndo}
              title="Undo (Cmd+Z)"
            >
              <img src="/icons/undo.svg" alt="Undo" />
            </button>
            <button 
              className="header-button header-icon-button" 
              onClick={redo} 
              disabled={!canRedo}
              title="Redo (Cmd+Shift+Z)"
            >
              <img src="/icons/redo.svg" alt="Redo" />
            </button>
          </div>
        </div>
        <div className="app-header-actions">
          <button className="header-button" onClick={importData} title="Import project">
            <img src="/icons/upload.svg" alt="Import" />
            <span>Import</span>
          </button>
          <button className="header-button" onClick={exportData} title="Export project">
            <img src="/icons/download.svg" alt="Export" />
            <span>Export</span>
          </button>
          <div className="options-menu-container">
            <button 
              className="header-button header-icon-button" 
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
              title="Options"
            >
              <img src="/icons/options.svg" alt="Options" />
            </button>
            {showOptionsMenu && (
              <div className="options-dropdown">
                <button 
                  className="options-menu-item" 
                  onClick={() => {
                    loadExample();
                    setShowOptionsMenu(false);
                  }}
                >
                  Load Example
                </button>
                <button 
                  className="options-menu-item options-menu-item--danger" 
                  onClick={() => {
                    clearCanvas();
                    setShowOptionsMenu(false);
                  }}
                >
                  Clear Canvas
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="app-content">
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
          onShiftNodes={shiftNodes}
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
