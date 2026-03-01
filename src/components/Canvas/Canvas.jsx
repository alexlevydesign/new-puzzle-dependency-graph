import React, { useRef, useState, useCallback, useEffect } from 'react';
import './Canvas.css';
import GraphNode from './GraphNode.jsx';
import ConnectionLine from './ConnectionLine.jsx';
import { NODE_CONFIG } from '../../constants/nodeTypes.jsx';
import { findInsertionIndex } from '../../utils/autoLayout.js';

const Canvas = ({
  nodes,
  connections,
  selectedNode,
  layoutMode,
  onNodeSelect,
  onAddNode,
  onNodeMove,
  onNodeReorder,
  onNodeDelete,
  onConnectionCreate,
  onConnectionRemove,
  onInsertNodeBetween,
  onCollapseSidebar,
  isDraggingNodeRef // Ref to track dragging for history management
}) => {
  const canvasRef = useRef(null);
  const contentRef = useRef(null);
  const [draggedNode, setDraggedNode] = useState(null);
  const [draggedNodePosition, setDraggedNodePosition] = useState(null); // Track visual position during drag
  const [connectionStart, setConnectionStart] = useState(null);
  const [tempConnectionEnd, setTempConnectionEnd] = useState(null);
  const [insertionPreview, setInsertionPreview] = useState(null);
  const [branchPreview, setBranchPreview] = useState(null); // { fromNodeId, position }
  const targetIndexRef = useRef(null); // Track target index for reordering
  const [commandPressed, setCommandPressed] = useState(false);
  
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
  }, [selectedNode, onNodeDelete]);

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('nodeType');
    
    if (!nodeType) return;

    const rect = canvasRef.current.getBoundingClientRect();
    // Account for zoom and pan when positioning dropped nodes
    const x = (e.clientX - rect.left - pan.x) / zoom - 100;
    const y = (e.clientY - rect.top - pan.y) / zoom - 50;

    // Check if dropping between two connected nodes
    if (insertionPreview) {
      const newNode = onAddNode(nodeType, { x, y });
      
      onInsertNodeBetween(
        newNode.id,
        insertionPreview.from,
        insertionPreview.to
      );
      setInsertionPreview(null);
      setBranchPreview(null);
      onNodeSelect(newNode);
    } else {
      const newNode = onAddNode(nodeType, { x, y });
      setBranchPreview(null);
      onNodeSelect(newNode);
    }
  };

  const handleCanvasDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    // Check if hovering over a connection line
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    // Check for branch creation (horizontal offset > 100px from main column in structured mode)
    if (layoutMode === 'structured' && nodes.length > 0) {
      const BRANCH_THRESHOLD = 100;
      const isOffsetHorizontally = Math.abs(x - 400) > BRANCH_THRESHOLD;
      
      if (isOffsetHorizontally) {
        // Find the node whose vertical bounds contain the drag Y position
        // Or if none contain it, find the closest by center position
        const eligibleNodes = nodes.filter(n => n.id !== draggedNode?.id);
        
        if (eligibleNodes.length > 0) {
          // First, try to find a node whose bounds contain the drag Y
          // Check ALL nodes and pick the best containing node (in case of overlaps)
          let containingNode = null;
          let bestContainmentScore = Infinity;
          
          for (const node of eligibleNodes) {
            const nodeElement = document.getElementById(`node-${node.id}`);
            const nodeHeight = nodeElement ? nodeElement.offsetHeight : 200;
            const nodeTop = node.position.y;
            const nodeBottom = node.position.y + nodeHeight;
            const nodeCenter = node.position.y + nodeHeight / 2;
            
            if (y >= nodeTop && y <= nodeBottom) {
              // Calculate how far from center (prefer nodes where drag is near center)
              const distanceFromCenter = Math.abs(y - nodeCenter);
              if (distanceFromCenter < bestContainmentScore) {
                bestContainmentScore = distanceFromCenter;
                containingNode = node;
              }
            }
          }
          
          // If no node contains the drag point, find closest by center Y position
          let closestNode = containingNode;
          
          if (!closestNode) {
            closestNode = eligibleNodes[0];
            const firstElement = document.getElementById(`node-${eligibleNodes[0].id}`);
            const firstHeight = firstElement ? firstElement.offsetHeight : 200;
            let minDistance = Math.abs(y - (eligibleNodes[0].position.y + firstHeight / 2));
            
            for (let i = 1; i < eligibleNodes.length; i++) {
              const nodeElement = document.getElementById(`node-${eligibleNodes[i].id}`);
              const nodeHeight = nodeElement ? nodeElement.offsetHeight : 200;
              const centerY = eligibleNodes[i].position.y + nodeHeight / 2;
              const distance = Math.abs(y - centerY);
              
              if (distance < minDistance) {
                minDistance = distance;
                closestNode = eligibleNodes[i];
              }
            }
          }
          
          setBranchPreview({ fromNodeId: closestNode.id, position: { x, y } });
          setInsertionPreview(null);
          return;
        }
      }
    }
    
    // Clear branch preview if not creating a branch
    setBranchPreview(null);

    let hoveredConnection = null;
    for (const conn of connections) {
      const fromNode = nodes.find(n => n.id === conn.from);
      const toNode = nodes.find(n => n.id === conn.to);
      
      if (fromNode && toNode) {
        const distance = distanceToLine(
          x, y,
          fromNode.position.x + 100,
          fromNode.position.y + 50,
          toNode.position.x + 100,
          toNode.position.y + 50
        );

        if (distance < 20) {
          hoveredConnection = conn;
          break;
        }
      }
    }

    setInsertionPreview(hoveredConnection);
  };

  const handleCanvasDragLeave = () => {
    setInsertionPreview(null);
    setBranchPreview(null);
  };

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

  const handleNodeDragStart = (node, e) => {
    // Allow dragging for reordering (structured) or positioning (freeform)
    setDraggedNode(node);
    setDraggedNodePosition(null); // Reset at start
    
    // Set flag to prevent history updates during drag
    if (isDraggingNodeRef) {
      isDraggingNodeRef.current = true;
    }
  };

  const handleNodeDrag = (node, position) => {
    // Store the visual position of the dragged node
    setDraggedNodePosition(position);
    
    if (layoutMode === 'structured') {
      // Structured mode: Calculate insertion index for reordering
      const targetIndex = findInsertionIndex(node.id, position.y, nodes);
      
      // Store in both state (for visual) and ref (for reliable access in dragEnd)
      targetIndexRef.current = targetIndex;
      setInsertionPreview(targetIndex);
    } else {
      // Freeform mode: Update position directly during drag
      onNodeMove(node.id, { position });
    }
  };

  const handleNodeDragEnd = () => {
    if (layoutMode === 'structured') {
      // Use the ref value for reordering
      if (targetIndexRef.current !== null && draggedNode) {
        onNodeReorder(draggedNode.id, targetIndexRef.current);
      }
    }
    // In freeform mode, position was already updated during drag
    
    // Clear dragged state
    setDraggedNode(null);
    setDraggedNodePosition(null);
    setInsertionPreview(null);
    targetIndexRef.current = null;
    
    // Clear the dragging flag and allow history to save
    if (isDraggingNodeRef) {
      isDraggingNodeRef.current = false;
    }
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

  const handleConnectionEnd = (targetNodeId) => {
    if (connectionStart && targetNodeId && connectionStart.nodeId !== targetNodeId) {
      onConnectionCreate(connectionStart.nodeId, targetNodeId);
    }
    setConnectionStart(null);
    setTempConnectionEnd(null);
  };

  // Helper function to calculate distance from point to line segment
  const distanceToLine = (px, py, x1, y1, x2, y2) => {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  return (
    <div
      ref={canvasRef}
      className="canvas"
      onDrop={handleCanvasDrop}
      onDragOver={handleCanvasDragOver}
      onDragLeave={handleCanvasDragLeave}
      onClick={handleCanvasClick}
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseEnter={onCollapseSidebar}
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
        {/* Hide connections only during structured mode reordering */}
        {!(draggedNode && layoutMode === 'structured') && connections.map((conn, index) => {
          const fromNode = nodes.find(n => n.id === conn.from);
          const toNode = nodes.find(n => n.id === conn.to);
          
          if (!fromNode || !toNode) return null;

          // Get actual node elements to calculate heights
          const fromNodeElement = document.querySelector(`[data-node-id="${fromNode.id}"]`);
          const toNodeElement = document.querySelector(`[data-node-id="${toNode.id}"]`);
          
          const fromNodeHeight = fromNodeElement ? fromNodeElement.offsetHeight : 100;
          const toNodeHeight = toNodeElement ? toNodeElement.offsetHeight : 100;

          // Use visual position for dragged node, state position otherwise
          let fromX = fromNode.position.x;
          let fromY = fromNode.position.y;
          let toX = toNode.position.x;
          let toY = toNode.position.y;

          // If this node is being dragged, use its visual drag position
          if (draggedNode && draggedNodePosition) {
            if (fromNode.id === draggedNode.id) {
              fromX = draggedNodePosition.x;
              fromY = draggedNodePosition.y;
            }
            if (toNode.id === draggedNode.id) {
              toX = draggedNodePosition.x;
              toY = draggedNodePosition.y;
            }
          }

          const isHighlighted = insertionPreview?.from === conn.from && 
                               insertionPreview?.to === conn.to;

          return (
            <ConnectionLine
              key={`${conn.from}-${conn.to}-${index}`}
              from={{
                x: fromX + 100,
                y: fromY + fromNodeHeight
              }}
              to={{
                x: toX + 100,
                y: toY
              }}
              isHighlighted={isHighlighted}
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
        {/* Branch preview indicator */}
        {branchPreview && (
          <>
            {(() => {
              const fromNode = nodes.find(n => n.id === branchPreview.fromNodeId);
              if (!fromNode) return null;
              
              const fromElement = document.getElementById(`node-${fromNode.id}`);
              const fromNodeHeight = fromElement ? fromElement.offsetHeight : 200;
              
              // Start from bottom center of the source node
              const startX = fromNode.position.x + 100;
              const startY = fromNode.position.y + fromNodeHeight;
              
              // End at the drag position
              const endX = branchPreview.position.x;
              const endY = branchPreview.position.y;
              
              return (
                <>
                  <ConnectionLine
                    from={{
                      x: startX,
                      y: startY
                    }}
                    to={{
                      x: endX,
                      y: endY
                    }}
                    isTemp={true}
                  />
                  {/* Preview circle at drag position */}
                  <circle
                    cx={endX}
                    cy={endY}
                    r="8"
                    fill="rgba(33, 150, 243, 0.3)"
                    stroke="#2196F3"
                    strokeWidth="2"
                    strokeDasharray="4,4"
                  />
                </>
              );
            })()}
          </>
        )}
      </svg>

      {/* Insertion indicator line */}
      {insertionPreview !== null && draggedNode && (
        <div
          className="insertion-indicator"
          style={{
            left: 400,
            top: 100 + (insertionPreview * 180) - 10,
            width: 200,
            height: 4,
            backgroundColor: '#2196F3',
            borderRadius: 2,
            position: 'absolute',
            pointerEvents: 'none',
            zIndex: 1000,
            boxShadow: '0 0 8px rgba(33, 150, 243, 0.5)'
          }}
        />
      )}

      {nodes.map(node => (
        <GraphNode
          key={node.id}
          node={node}
          isSelected={selectedNode?.id === node.id}
          isCommandPressed={commandPressed}
          isDragging={draggedNode?.id === node.id}
          layoutMode={layoutMode}
          zoom={zoom}
          pan={pan}
          onSelect={onNodeSelect}
          onDragStart={handleNodeDragStart}
          onDrag={handleNodeDrag}
          onDragEnd={handleNodeDragEnd}
          onConnectionStart={handleConnectionStart}
          onConnectionDrag={handleConnectionDrag}
          onConnectionEnd={handleConnectionEnd}
        />
      ))}
      </div>

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
