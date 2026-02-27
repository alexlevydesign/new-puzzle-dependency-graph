import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import './App.css';
import Sidebar from './components/Sidebar/Sidebar.jsx';
import Canvas from './components/Canvas/Canvas.jsx';
import NodePropertiesPanel from './components/NodePropertiesPanel/NodePropertiesPanel.jsx';
import { NODE_CONFIG } from './constants/nodeTypes.jsx';
import { calculateAutoLayout, reorderNodes } from './utils/autoLayout.js';

function App() {
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nextNodeId, setNextNodeId] = useState(1);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [layoutMode, setLayoutMode] = useState('structured'); // 'structured' or 'freeform'
  
  // History management for undo/redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoAction = useRef(false);
  const isDraggingNode = useRef(false); // Track if a node is currently being dragged

  // Save state to history whenever nodes or connections change
  useEffect(() => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }
    
    // Don't save history during node dragging in freeform mode
    if (isDraggingNode.current) {
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

  // Keyboard shortcuts for undo/redo and node reordering
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
      // Arrow Up: Move selected node up in the list
      else if (e.key === 'ArrowUp' && selectedNode) {
        e.preventDefault();
        moveNodeInList(selectedNode.id, -1);
      }
      // Arrow Down: Move selected node down in the list
      else if (e.key === 'ArrowDown' && selectedNode) {
        e.preventDefault();
        moveNodeInList(selectedNode.id, 1);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedNode, nodes]);

  const moveNodeInList = useCallback((nodeId, direction) => {
    const currentIndex = nodes.findIndex(n => n.id === nodeId);
    if (currentIndex === -1) return;

    const targetIndex = currentIndex + direction;
    
    // Check bounds
    if (targetIndex < 0 || targetIndex >= nodes.length) return;

    // Reorder the nodes array
    const reordered = reorderNodes(nodes, currentIndex, targetIndex);
    setNodes(reordered);
  }, [nodes]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Auto-layout: Recalculate positions when entering structured mode or when structure changes
  const nodeOrderKey = useMemo(() => nodes.map(n => n.id).join(','), [nodes]);
  const connectionKey = useMemo(() => connections.map(c => `${c.from}-${c.to}`).join(','), [connections]);
  
  useEffect(() => {
    if (nodes.length === 0) return;
    if (layoutMode !== 'structured') return;

    // Calculate new positions
    const positions = calculateAutoLayout(nodes, connections);
    
    // Check if any positions actually changed
    const hasChanges = nodes.some(node => {
      const newPos = positions[node.id];
      return newPos && (newPos.x !== node.position.x || newPos.y !== node.position.y);
    });

    if (hasChanges) {
      // Update node positions without triggering history
      isUndoRedoAction.current = true;
      setNodes(prev => prev.map(node => ({
        ...node,
        position: positions[node.id] || node.position
      })));
    }
  }, [layoutMode, nodeOrderKey, connectionKey]);

  const addNode = useCallback((type, position) => {
    const newNode = {
      id: nextNodeId,
      type,
      title: NODE_CONFIG[type].defaultTitle,
      description: '',
      position: position || { x: 0, y: 0 },
      items: [],
      tags: [],
      dependencies: []
    };
    
    setNodes(prev => {
      const newNodes = [...prev, newNode];
      
      // Auto-connect in structured mode based on position
      if (layoutMode === 'structured' && position && prev.length > 0) {
        const BRANCH_THRESHOLD = 100; // Horizontal distance to trigger branch creation
        
        // Check if this is a branch (significantly offset horizontally from main column)
        const isOffsetHorizontally = Math.abs(position.x - 400) > BRANCH_THRESHOLD;
        
        if (isOffsetHorizontally) {
          // BRANCH MODE: Create parallel branch from nearest node
          // Find the node closest in Y position to branch from
          let closestNodeIndex = 0;
          let minDistance = Math.abs(position.y - prev[0].position.y);
          
          for (let i = 1; i < prev.length; i++) {
            const distance = Math.abs(position.y - prev[i].position.y);
            if (distance < minDistance) {
              minDistance = distance;
              closestNodeIndex = i;
            }
          }
          
          // Insert after the closest node
          newNodes.splice(prev.length, 1); // Remove from end
          newNodes.splice(closestNodeIndex + 1, 0, newNode); // Insert after closest
          
          // Create branch connection from closest node
          setConnections(prevConn => {
            const newConnections = [...prevConn];
            newConnections.push({
              from: prev[closestNodeIndex].id,
              to: newNode.id
            });
            return newConnections;
          });
        } else {
          // SEQUENTIAL MODE: Insert in sequence based on Y position
          let insertIndex = prev.length; // Default to end
          
          for (let i = 0; i < prev.length; i++) {
            // Use the bottom half of the node as the threshold
            const nodeBottom = prev[i].position.y + 50; // Approximate middle of node (100px height)
            
            if (position.y < nodeBottom) {
              insertIndex = i;
              break;
            }
          }
          
          // Insert at the calculated position
          newNodes.splice(prev.length, 1); // Remove from end
          newNodes.splice(insertIndex, 0, newNode); // Insert at correct position
          
          // Auto-connect to neighbors
          setConnections(prevConn => {
            let newConnections = [...prevConn];
            
            // If inserting at the end
            if (insertIndex === prev.length) {
              // Connect last node to new node
              if (prev.length > 0) {
                newConnections.push({
                  from: prev[prev.length - 1].id,
                  to: newNode.id
                });
              }
            }
            // If inserting at the beginning
            else if (insertIndex === 0) {
              // Connect new node to first node
              if (prev.length > 0) {
                newConnections.push({
                  from: newNode.id,
                  to: prev[0].id
                });
              }
            }
            // If inserting in the middle
            else {
              const prevNodeId = prev[insertIndex - 1].id;
              const nextNodeId = prev[insertIndex].id;
              
              // Remove connection between prev and next
              newConnections = newConnections.filter(conn => 
                !(conn.from === prevNodeId && conn.to === nextNodeId)
              );
              
              // Add connections: prev -> new -> next
              newConnections.push(
                { from: prevNodeId, to: newNode.id },
                { from: newNode.id, to: nextNodeId }
              );
            }
            
            return newConnections;
          });
        }
      }
      
      return newNodes;
    });
    
    setNextNodeId(prev => prev + 1);
    return newNode;
  }, [nextNodeId, layoutMode, connections, nodes]);

  const reorderNode = useCallback((nodeId, newIndex) => {
    const currentIndex = nodes.findIndex(n => n.id === nodeId);
    if (currentIndex === -1 || currentIndex === newIndex) return;

    const reordered = reorderNodes(nodes, currentIndex, newIndex);
    setNodes(reordered);

    // Update connections to maintain sequential chain based on new order
    setConnections(prev => {
      // Remove connections involving the moved node and its old neighbors
      let filtered = prev.filter(conn => {
        // Remove if the moved node is involved
        if (conn.from === nodeId || conn.to === nodeId) return false;
        
        // Remove connection between old neighbors (they were connected through the moved node)
        if (currentIndex > 0 && currentIndex < nodes.length - 1) {
          const prevNode = nodes[currentIndex - 1];
          const nextNode = nodes[currentIndex + 1];
          if (conn.from === prevNode.id && conn.to === nextNode.id) return false;
        }
        
        return true;
      });
      
      const newConnections = [...filtered];
      
      // Rebuild connections based on new positions
      // Connect previous neighbor to next neighbor at old position (if both exist)
      if (currentIndex > 0 && currentIndex < nodes.length - 1) {
        newConnections.push({
          from: nodes[currentIndex - 1].id,
          to: nodes[currentIndex + 1].id
        });
      }
      
      // Connect node to its new neighbors
      if (newIndex > 0) {
        newConnections.push({
          from: reordered[newIndex - 1].id,
          to: nodeId
        });
      }
      
      if (newIndex < reordered.length - 1) {
        newConnections.push({
          from: nodeId,
          to: reordered[newIndex + 1].id
        });
      }
      
      // Remove the connection we just created between new neighbors (since moved node is now between them)
      if (newIndex > 0 && newIndex < reordered.length - 1) {
        return newConnections.filter(conn => 
          !(conn.from === reordered[newIndex - 1].id && conn.to === reordered[newIndex + 1].id)
        );
      }
      
      return newConnections;
    });
  }, [nodes]);

  const tidyUp = useCallback(() => {
    // Build a map of connected nodes
    const connectedNodeIds = new Set();
    connections.forEach(conn => {
      connectedNodeIds.add(conn.from);
      connectedNodeIds.add(conn.to);
    });

    // Separate connected and disconnected nodes
    const connectedNodes = nodes.filter(n => connectedNodeIds.has(n.id));
    const disconnectedNodes = nodes.filter(n => !connectedNodeIds.has(n.id));

    // Calculate layout for connected nodes (main column)
    const connectedPositions = calculateAutoLayout(connectedNodes, connections);

    // Calculate layout for disconnected nodes (side column)
    const disconnectedPositions = {};
    disconnectedNodes.forEach((node, index) => {
      disconnectedPositions[node.id] = {
        x: 700, // Offset to the right
        y: 100 + (index * 180)
      };
    });

    // Merge all positions
    const allPositions = { ...connectedPositions, ...disconnectedPositions };

    // Update all node positions
    isUndoRedoAction.current = true;
    setNodes(prev => prev.map(node => ({
      ...node,
      position: allPositions[node.id] || node.position
    })));
  }, [nodes, connections]);

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
        <div className="app-header-left">
          <h1 className="app-title">
            Puzz<span className="app-title-accent">Flow</span>
          </h1>
        </div>
        
        <div className="app-header-center">
          {/* Undo/Redo */}
          <div className="header-control-group">
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

          {/* Mode Switcher */}
          <div className="mode-switcher">
            <button 
              className={`mode-switcher-button ${layoutMode === 'structured' ? 'active' : ''}`}
              onClick={() => setLayoutMode('structured')}
              title="Structured mode - nodes auto-arrange vertically"
            >
              Structured
            </button>
            <button 
              className={`mode-switcher-button ${layoutMode === 'freeform' ? 'active' : ''}`}
              onClick={() => setLayoutMode('freeform')}
              title="Freeform mode - drag nodes anywhere"
            >
              Freeform
            </button>
          </div>

          {/* Tidy Up (only in freeform mode) */}
          {layoutMode === 'freeform' && (
            <button 
              className="header-button header-icon-button"
              onClick={tidyUp}
              title="Tidy Up - organize nodes in structured layout"
            >
              🧹
            </button>
          )}
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
        </div>
      </header>
      <div className="app-content">
        <Sidebar 
          onNodeTypeSelect={addNode}
          isExpanded={isSidebarExpanded}
          onExpand={() => setIsSidebarExpanded(true)}
        />
        <Canvas
          nodes={nodes}
          connections={connections}
          selectedNode={selectedNode}
          layoutMode={layoutMode}
          onNodeSelect={setSelectedNode}
          onAddNode={addNode}
          onNodeMove={updateNode}
          onNodeReorder={reorderNode}
          onNodeDelete={deleteNode}
          onConnectionCreate={addConnection}
          onConnectionRemove={removeConnection}
          onInsertNodeBetween={insertNodeBetween}
          onCollapseSidebar={() => setIsSidebarExpanded(false)}
          isDraggingNodeRef={isDraggingNode}
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
