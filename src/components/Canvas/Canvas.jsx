import React, { useRef, useState, useCallback, useEffect } from 'react';
import './Canvas.css';
import GraphNode from './GraphNode.jsx';
import ConnectionLine from './ConnectionLine.jsx';
import { NODE_CONFIG, NODE_TYPES } from '../../constants/nodeTypes.jsx';

// Minimum vertical gap between a parent node's bottom edge and its child's top edge
const NODE_VERTICAL_GAP = 120;

const Canvas = ({
  nodes,
  connections,
  selectedNode,
  onNodeSelect,
  onAddNode,
  onNodeMove,
  onNodeDelete,
  onConnectionCreate,
  onConnectionRemove,
  onInsertNodeBetween,
  onShiftNodes
}) => {
  const canvasRef = useRef(null);
  const contentRef = useRef(null);
  const contextMenuRef = useRef(null);
  const [connectionStart, setConnectionStart] = useState(null);
  const [tempConnectionEnd, setTempConnectionEnd] = useState(null);
  const [commandPressed, setCommandPressed] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ left: 0, top: 0 });
  const [addBelowMenu, setAddBelowMenu] = useState(null); // { sourceNode, position }
  const [addBranchMenu, setAddBranchMenu] = useState(null); // { sourceNode, position }
  const [insertBetweenMenu, setInsertBetweenMenu] = useState(null); // { fromNode, toNode, position, newNodePosition }
  const [emptyStateMenu, setEmptyStateMenu] = useState(false);
  
  // Pan and Zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);

  // Track command key and space key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey) {
        setCommandPressed(true);
      }
      if (e.code === 'Space' && !e.repeat) {
        // Don't prevent default if user is typing in an input or textarea
        const isTyping = e.target.tagName === 'INPUT' || 
                        e.target.tagName === 'TEXTAREA' || 
                        e.target.isContentEditable;
        if (!isTyping) {
          e.preventDefault();
          setSpacePressed(true);
        }
      }
      // Close context menu with Escape key
      if (e.code === 'Escape' && contextMenu) {
        e.preventDefault();
        setContextMenu(null);
      }
      // Delete selected node with Backspace or Delete key
      if ((e.code === 'Backspace' || e.code === 'Delete') && selectedNode) {
        const isTyping = e.target.tagName === 'INPUT' || 
                        e.target.tagName === 'TEXTAREA' || 
                        e.target.isContentEditable;
        if (!isTyping) {
          e.preventDefault();
          onNodeDelete(selectedNode.id);
        }
      }
    };

    const handleKeyUp = (e) => {
      if (!e.metaKey && !e.ctrlKey) {
        setCommandPressed(false);
      }
      if (e.code === 'Space') {
        setSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedNode, onNodeDelete, contextMenu]);

  // Calculate context menu position to keep it within viewport bounds
  useEffect(() => {
    if (contextMenu && contextMenuRef.current && canvasRef.current) {
      const menuRect = contextMenuRef.current.getBoundingClientRect();
      const canvasRect = canvasRef.current.getBoundingClientRect();
      
      // Calculate initial position (centered horizontally, offset vertically)
      let left = contextMenu.position.x * zoom + pan.x - (menuRect.width / 2);
      let top = contextMenu.position.y * zoom + pan.y + 10; // 10px below cursor
      
      // Adjust horizontal position if menu extends beyond right edge
      if (left + menuRect.width > canvasRect.width) {
        left = canvasRect.width - menuRect.width - 10; // 10px padding from edge
      }
      
      // Adjust horizontal position if menu extends beyond left edge
      if (left < 10) {
        left = 10; // 10px padding from edge
      }
      
      // Adjust vertical position if menu extends beyond bottom edge
      if (top + menuRect.height > canvasRect.height) {
        // Position above the cursor instead
        top = contextMenu.position.y * zoom + pan.y - menuRect.height - 10;
      }
      
      // Adjust vertical position if menu extends beyond top edge
      if (top < 10) {
        top = 10; // 10px padding from edge
      }
      
      setContextMenuPosition({ left, top });
    }
  }, [contextMenu, zoom, pan]);

  const handleCanvasClick = (e) => {
    if (e.target === canvasRef.current || e.target === contentRef.current) {
      onNodeSelect(null);
    }
  };

  // Prevent default browser zoom on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventDefaultZoom = (e) => {
      // Prevent Ctrl/Cmd + wheel zoom
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    const preventPinchZoom = (e) => {
      // Prevent pinch-to-zoom on touch devices
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    };

    canvas.addEventListener('wheel', preventDefaultZoom, { passive: false });
    canvas.addEventListener('touchmove', preventPinchZoom, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', preventDefaultZoom);
      canvas.removeEventListener('touchmove', preventPinchZoom);
    };
  }, []);

  // Zoom handling - now works without Ctrl/Cmd
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.01;
    const newZoom = Math.min(Math.max(0.1, zoom + delta), 3);
    
    // Zoom towards mouse position
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomPointX = (mouseX - pan.x) / zoom;
    const zoomPointY = (mouseY - pan.y) / zoom;
    
    setPan({
      x: mouseX - zoomPointX * newZoom,
      y: mouseY - zoomPointY * newZoom
    });
    
    setZoom(newZoom);
  }, [zoom, pan]);

  // Pan handling - now works with just click and drag on canvas
  const handleCanvasMouseDown = (e) => {
    // Only pan if clicking directly on canvas or canvas-content, not on nodes
    if (e.target === canvasRef.current || e.target === contentRef.current || e.target.classList.contains('canvas-connections')) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleCanvasMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }
  };

  // Add global mouse event listeners when panning to handle cursor leaving window
  useEffect(() => {
    if (isPanning) {
      const handleGlobalMouseMove = (e) => {
        setPan({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y
        });
      };

      const handleGlobalMouseUp = () => {
        setIsPanning(false);
      };

      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isPanning, panStart]);

  // Reset zoom and pan
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleConnectionStart = (nodeId, position, isFromInput = false) => {
    // If dragging from input, just remove the connection (no reconnection)
    if (isFromInput) {
      const incomingConn = connections.find(c => c.to === nodeId);
      if (incomingConn) {
        onConnectionRemove(incomingConn.from, incomingConn.to);
      }
      // Don't set connectionStart - this prevents showing temp line
      setConnectionStart(null);
      setTempConnectionEnd(null);
    } else {
      setConnectionStart({ nodeId, position });
    }
  };

  const handleConnectionDrag = (position) => {
    // Only update if we have a valid connection start (from output point)
    if (connectionStart) {
      setTempConnectionEnd(position);
    }
  };

  const handleConnectionEnd = (targetNodeId, releasePosition = null) => {
    if (connectionStart && targetNodeId && connectionStart.nodeId !== targetNodeId) {
      onConnectionCreate(connectionStart.nodeId, targetNodeId);
      setConnectionStart(null);
      setTempConnectionEnd(null);
    } else if (connectionStart && !targetNodeId) {
      // Connection was released without connecting to a node
      // Show context menu at the release position
      const position = releasePosition || tempConnectionEnd;
      if (position) {
        setContextMenu({
          position: position,
          sourceNodeId: connectionStart.nodeId
        });
      }
      setConnectionStart(null);
      setTempConnectionEnd(null);
    } else {
      setConnectionStart(null);
      setTempConnectionEnd(null);
    }
  };

  const handleContextMenuNodeSelect = (nodeType) => {
    if (!contextMenu) return;

    // Create new node at context menu position
    const newNode = onAddNode(nodeType, {
      x: contextMenu.position.x - 100, // Center the node on cursor
      y: contextMenu.position.y
    });

    // Connect the source node to the new node
    onConnectionCreate(contextMenu.sourceNodeId, newNode.id);
    
    // Select the new node
    onNodeSelect(newNode);
    
    // Close context menu
    setContextMenu(null);
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  // Returns the Y position that keeps a new BELOW-child of sourceNode on the same
  // row as any already-existing below-children (same X column).
  // Falls back to sourceNode.y + nodeHeight + NODE_VERTICAL_GAP if no children yet.
  const getChildY = (sourceNode) => {
    const nodeElement = document.querySelector(`[data-node-id="${sourceNode.id}"]`);
    const nodeHeight = nodeElement ? nodeElement.offsetHeight : 100;
    const defaultY = sourceNode.position.y + nodeHeight + NODE_VERTICAL_GAP;

    // Find all direct children of this source node
    const childIds = connections
      .filter(c => c.from === sourceNode.id)
      .map(c => c.to);
    if (childIds.length === 0) return defaultY;

    const childNodes = nodes.filter(n => childIds.includes(n.id));
    const maxChildY = Math.max(...childNodes.map(n => n.position.y));
    return Math.max(defaultY, maxChildY);
  };

  const handleAddBelow = (sourceNode) => {
    const nodeElement = document.querySelector(`[data-node-id="${sourceNode.id}"]`);
    const nodeHeight = nodeElement ? nodeElement.offsetHeight : 100;
    const newY = getChildY(sourceNode);
    setAddBelowMenu({
      sourceNode,
      position: {
        x: sourceNode.position.x + 100,
        y: sourceNode.position.y + nodeHeight + 20
      },
      newNodePosition: {
        x: sourceNode.position.x,
        y: newY
      }
    });
  };

  const handleAddBelowNodeSelect = (nodeType) => {
    if (!addBelowMenu) return;
    const { sourceNode, newNodePosition } = addBelowMenu;

    const newNodeBottom = newNodePosition.y + 100 + NODE_VERTICAL_GAP;
    // Pass sourceNode.position.x as columnX so only nodes in the same vertical
    // column get shifted down — lateral siblings at the same Y stay put.
    onShiftNodes([sourceNode.id], newNodePosition.y, newNodeBottom, null, 0, sourceNode.position.x);

    const newNode = onAddNode(nodeType, newNodePosition);
    onConnectionCreate(sourceNode.id, newNode.id);
    onNodeSelect(newNode);
    setAddBelowMenu(null);
  };

  const handleCloseAddBelowMenu = () => {
    setAddBelowMenu(null);
  };

  const handleAddBranch = (sourceNode, direction) => {
    const nodeElement = document.querySelector(`[data-node-id="${sourceNode.id}"]`);
    const nodeHeight = nodeElement ? nodeElement.offsetHeight : 100;
    const offsetX = direction === 'right' ? 280 : -280;
    // Branch nodes should sit at the same Y as any below-child of this source node.
    // getChildY returns sourceNode.y + height + 80 when no children exist yet,
    // or the max Y of existing children — so all siblings (below + branch) share one row.
    const newY = getChildY(sourceNode);
    setAddBranchMenu({
      sourceNode,
      direction,
      position: {
        x: sourceNode.position.x + (direction === 'right' ? 200 + 60 : -60),
        y: sourceNode.position.y + nodeHeight / 2
      },
      newNodePosition: {
        x: sourceNode.position.x + offsetX,
        y: newY
      }
    });
  };

  const handleAddBranchNodeSelect = (nodeType) => {
    if (!addBranchMenu) return;
    const { sourceNode, direction, newNodePosition } = addBranchMenu;

    // Shift nodes sideways to make room for the branch node
    if (direction === 'right') {
      // Shift any nodes already at or to the right of the new position
      onShiftNodes([sourceNode.id], null, 0, newNodePosition.x, 280);
    }
    // Left branch: nodes to the left will be shifted left similarly
    // Using a negative deltaX — thresholdX is the new node's right edge
    if (direction === 'left') {
      onShiftNodes([sourceNode.id], null, 0, newNodePosition.x, -280);
    }

    const newNode = onAddNode(nodeType, newNodePosition);
    onConnectionCreate(sourceNode.id, newNode.id);
    onNodeSelect(newNode);
    setAddBranchMenu(null);
  };

  const handleCloseAddBranchMenu = () => {
    setAddBranchMenu(null);
  };

  const handleInsertBetween = (fromNode, toNode) => {
    const NODE_WIDTH = 200;
    const HORIZONTAL_GAP = 80;
    const fromEl = document.querySelector(`[data-node-id="${fromNode.id}"]`);
    const fromHeight = fromEl ? fromEl.offsetHeight : 100;

    // A connection is horizontal when the two nodes share roughly the same Y level
    // Use a tight threshold (30px) — branch siblings are placed at identical Y
    const isHorizontal = Math.abs(toNode.position.y - fromNode.position.y) < 30;

    let newNodePosition, menuPosition;
    if (isHorizontal) {
      const goingRight = toNode.position.x > fromNode.position.x;
      // The new node slots into toNode's current X — toNode will be shifted out
      const newX = goingRight
        ? fromNode.position.x + NODE_WIDTH + HORIZONTAL_GAP
        : fromNode.position.x - NODE_WIDTH - HORIZONTAL_GAP;
      newNodePosition = { x: newX, y: fromNode.position.y };
      // Show the menu just above the midpoint of the connection
      const midX = (fromNode.position.x + toNode.position.x) / 2 + NODE_WIDTH / 2;
      menuPosition = { x: midX, y: fromNode.position.y - 20 };
    } else {
      const newY = fromNode.position.y + fromHeight + NODE_VERTICAL_GAP;
      newNodePosition = { x: fromNode.position.x, y: newY };
      menuPosition = { x: fromNode.position.x + 100, y: newY + 20 };
    }

    setInsertBetweenMenu({
      fromNode,
      toNode,
      isHorizontal,
      position: menuPosition,
      newNodePosition
    });
  };

  const handleInsertBetweenNodeSelect = (nodeType) => {
    if (!insertBetweenMenu) return;
    const { fromNode, toNode, isHorizontal, newNodePosition } = insertBetweenMenu;

    if (isHorizontal) {
      const goingRight = toNode.position.x > fromNode.position.x;
      const NODE_WIDTH = 200;
      const HORIZONTAL_GAP = 80;
      const shiftAmount = NODE_WIDTH + HORIZONTAL_GAP;

      if (goingRight) {
        // Push toNode and every node at or beyond its X rightward — Y unchanged
        onShiftNodes([fromNode.id], null, 0, toNode.position.x, shiftAmount);
      } else {
        // Push toNode and every node at or before its X leftward — Y unchanged
        onShiftNodes([fromNode.id], null, 0, null, 0, null, 150, toNode.position.x, -shiftAmount);
      }
    } else {
      const newNodeBottom = newNodePosition.y + 100 + NODE_VERTICAL_GAP;
      onShiftNodes([fromNode.id], toNode.position.y, newNodeBottom, null, 0, fromNode.position.x);
    }

    const newNode = onAddNode(nodeType, newNodePosition);
    onInsertNodeBetween(newNode.id, fromNode.id, toNode.id);
    onNodeSelect(newNode);
    setInsertBetweenMenu(null);
  };

  const handleCloseInsertBetweenMenu = () => {
    setInsertBetweenMenu(null);
  };

  const handleEmptyStateNodeSelect = (nodeType) => {
    const newNode = onAddNode(nodeType, { x: 300, y: 200 });
    onNodeSelect(newNode);
    setEmptyStateMenu(false);
  };

  return (
    <div
      ref={canvasRef}
      className="canvas"
      onClick={handleCanvasClick}
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      style={{ 
        cursor: isPanning ? 'grabbing' : 'grab'
      }}
    >
      <div 
        ref={contentRef}
        className="canvas-content"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        <svg className="canvas-connections" style={{ overflow: 'visible' }}>
        {connections.map((conn, index) => {
          const fromNode = nodes.find(n => n.id === conn.from);
          const toNode = nodes.find(n => n.id === conn.to);
          
          if (!fromNode || !toNode) return null;

          // Get actual node elements to calculate heights
          const fromNodeElement = document.querySelector(`[data-node-id="${fromNode.id}"]`);
          const toNodeElement = document.querySelector(`[data-node-id="${toNode.id}"]`);
          
          const fromNodeHeight = fromNodeElement ? fromNodeElement.offsetHeight : 100;
          const toNodeHeight = toNodeElement ? toNodeElement.offsetHeight : 100;

          return (
            <ConnectionLine
              key={`${conn.from}-${conn.to}-${index}`}
              from={{
                x: fromNode.position.x + 100,
                y: fromNode.position.y + fromNodeHeight
              }}
              to={{
                x: toNode.position.x + 100,
                y: toNode.position.y
              }}
              isHighlighted={false}
              onAddBetween={() => handleInsertBetween(fromNode, toNode)}
            />
          );
        })}
        {connectionStart && tempConnectionEnd && (
          <ConnectionLine
            from={connectionStart.position}
            to={tempConnectionEnd}
            isTemp={true}
          />
        )}
      </svg>

      {nodes.map(node => (
        <GraphNode
          key={node.id}
          node={node}
          isSelected={selectedNode?.id === node.id}
          isCommandPressed={commandPressed}
          zoom={zoom}
          pan={pan}
          onSelect={onNodeSelect}
          onConnectionStart={handleConnectionStart}
          onConnectionDrag={handleConnectionDrag}
          onConnectionEnd={handleConnectionEnd}
          onAddBelow={handleAddBelow}
          onAddBranch={handleAddBranch}
        />
      ))}
      </div>

      {/* Context Menu for Node Selection (from connection drag) */}
      {contextMenu && (
        <>
          <div className="context-menu-overlay" onClick={handleCloseContextMenu} />
          <div 
            ref={contextMenuRef}
            className="connection-context-menu"
            style={{
              left: `${contextMenuPosition.left}px`,
              top: `${contextMenuPosition.top}px`
            }}
          >
            <div className="context-menu-header">Add Node</div>
            {Object.values(NODE_TYPES).map(type => {
              const config = NODE_CONFIG[type];
              return (
                <button
                  key={type}
                  className="context-menu-item"
                  onClick={() => handleContextMenuNodeSelect(type)}
                  style={{ borderLeftColor: config.color }}
                >
                  <img src={config.icon} alt={config.label} className="context-menu-icon" />
                  <span>{config.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Add-Below Node Type Menu */}
      {addBelowMenu && (() => {
        const screenX = addBelowMenu.position.x * zoom + pan.x;
        const screenY = addBelowMenu.position.y * zoom + pan.y;
        return (
          <>
            <div className="context-menu-overlay" onClick={handleCloseAddBelowMenu} />
            <div
              className="connection-context-menu add-below-menu"
              style={{
                left: `${screenX}px`,
                top: `${screenY}px`,
                transform: 'translateX(-50%)'
              }}
            >
              <div className="context-menu-header">Add Node Below</div>
              {Object.values(NODE_TYPES).map(type => {
                const config = NODE_CONFIG[type];
                return (
                  <button
                    key={type}
                    className="context-menu-item"
                    onClick={() => handleAddBelowNodeSelect(type)}
                    style={{ borderLeftColor: config.color }}
                  >
                    <img src={config.icon} alt={config.label} className="context-menu-icon" />
                    <span>{config.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        );
      })()}

      {/* Add Branch Node Type Menu */}
      {addBranchMenu && (() => {
        const screenX = addBranchMenu.position.x * zoom + pan.x;
        const screenY = addBranchMenu.position.y * zoom + pan.y;
        return (
          <>
            <div className="context-menu-overlay" onClick={handleCloseAddBranchMenu} />
            <div
              className="connection-context-menu"
              style={{
                left: `${screenX}px`,
                top: `${screenY}px`,
                transform: 'translateY(-50%)'
              }}
            >
              <div className="context-menu-header">Add Branch</div>
              {Object.values(NODE_TYPES).map(type => {
                const config = NODE_CONFIG[type];
                return (
                  <button
                    key={type}
                    className="context-menu-item"
                    onClick={() => handleAddBranchNodeSelect(type)}
                    style={{ borderLeftColor: config.color }}
                  >
                    <img src={config.icon} alt={config.label} className="context-menu-icon" />
                    <span>{config.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        );
      })()}

      {/* Insert-Between Node Type Menu */}
      {insertBetweenMenu && (() => {
        const screenX = insertBetweenMenu.position.x * zoom + pan.x;
        const screenY = insertBetweenMenu.position.y * zoom + pan.y;
        return (
          <>
            <div className="context-menu-overlay" onClick={handleCloseInsertBetweenMenu} />
            <div
              className="connection-context-menu add-below-menu"
              style={{
                left: `${screenX}px`,
                top: `${screenY}px`,
                transform: 'translateX(-50%)'
              }}
            >
              <div className="context-menu-header">Insert Node</div>
              {Object.values(NODE_TYPES).map(type => {
                const config = NODE_CONFIG[type];
                return (
                  <button
                    key={type}
                    className="context-menu-item"
                    onClick={() => handleInsertBetweenNodeSelect(type)}
                    style={{ borderLeftColor: config.color }}
                  >
                    <img src={config.icon} alt={config.label} className="context-menu-icon" />
                    <span>{config.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        );
      })()}

      {/* Empty state — shown when there are no nodes */}      {nodes.length === 0 && !emptyStateMenu && (
        <div className="canvas-empty-state">
          <p className="canvas-empty-label">No nodes yet</p>
          <button
            className="canvas-empty-add-btn"
            onClick={(e) => { e.stopPropagation(); setEmptyStateMenu(true); }}
          >
            <img src="/icons/add.svg" alt="Add" />
            Add first node
          </button>
        </div>
      )}

      {/* Empty-state node type picker */}
      {emptyStateMenu && (
        <>
          <div className="context-menu-overlay" onClick={() => setEmptyStateMenu(false)} />
          <div className="connection-context-menu empty-state-menu">
            <div className="context-menu-header">Choose a node type</div>
            {Object.values(NODE_TYPES).map(type => {
              const config = NODE_CONFIG[type];
              return (
                <button
                  key={type}
                  className="context-menu-item"
                  onClick={() => handleEmptyStateNodeSelect(type)}
                  style={{ borderLeftColor: config.color }}
                >
                  <img src={config.icon} alt={config.label} className="context-menu-icon" />
                  <span>{config.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Zoom Controls */}
      <div className="zoom-controls">
        <button onClick={() => setZoom(z => Math.min(z + 0.1, 2))} title="Zoom In">+</button>
        <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))} title="Zoom Out">-</button>
        <button onClick={handleResetView} title="Reset View">⟲</button>
        <span className="zoom-level">{Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
};

export default Canvas;
