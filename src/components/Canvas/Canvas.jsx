import React, { useRef, useState, useCallback, useEffect } from 'react';
import './Canvas.css';
import GraphNode from './GraphNode.jsx';
import ConnectionLine from './ConnectionLine.jsx';
import { NODE_CONFIG } from '../../constants/nodeTypes.jsx';

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
  onInsertNodeBetween
}) => {
  const canvasRef = useRef(null);
  const contentRef = useRef(null);
  const [draggedNode, setDraggedNode] = useState(null);
  const [connectionStart, setConnectionStart] = useState(null);
  const [tempConnectionEnd, setTempConnectionEnd] = useState(null);
  const [insertionPreview, setInsertionPreview] = useState(null);
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
      onNodeSelect(newNode);
    } else {
      const newNode = onAddNode(nodeType, { x, y });
      onNodeSelect(newNode);
    }
  };

  const handleCanvasDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    // Check if hovering over a connection line
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

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
    if (commandPressed) {
      // Disconnect mode - find and remove connections
      const incomingConns = connections.filter(c => c.to === node.id);
      incomingConns.forEach(conn => onConnectionRemove(conn.from, conn.to));
    }
    setDraggedNode(node);
  };

  const handleNodeDrag = (node, position) => {
    onNodeMove(node.id, { position });
    
    // Check if dragging over a connection line
    const nodeCenterX = position.x + 100;
    const nodeCenterY = position.y + 50;
    
    let hoveredConnection = null;
    for (const conn of connections) {
      // Skip connections that involve this node
      if (conn.from === node.id || conn.to === node.id) continue;
      
      const fromNode = nodes.find(n => n.id === conn.from);
      const toNode = nodes.find(n => n.id === conn.to);
      
      if (fromNode && toNode) {
        // Get actual node heights
        const fromNodeElement = document.querySelector(`[data-node-id="${fromNode.id}"]`);
        const fromNodeHeight = fromNodeElement ? fromNodeElement.offsetHeight : 100;
        
        const distance = distanceToLine(
          nodeCenterX,
          nodeCenterY,
          fromNode.position.x + 100,
          fromNode.position.y + fromNodeHeight,
          toNode.position.x + 100,
          toNode.position.y
        );

        if (distance < 30) {
          hoveredConnection = conn;
          break;
        }
      }
    }
    
    setInsertionPreview(hoveredConnection);
  };

  const handleNodeDragEnd = () => {
    // If we're hovering over a connection, insert the node between
    if (insertionPreview && draggedNode) {
      onInsertNodeBetween(
        draggedNode.id,
        insertionPreview.from,
        insertionPreview.to
      );
    }
    setDraggedNode(null);
    setInsertionPreview(null);
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

          const isHighlighted = insertionPreview?.from === conn.from && 
                               insertionPreview?.to === conn.to;

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
