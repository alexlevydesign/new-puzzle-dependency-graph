import React, { useRef, useState, useCallback, useEffect } from 'react';
import './Canvas.css';
import GraphNode from './GraphNode.jsx';
import ConnectionLine from './ConnectionLine.jsx';
import AddNodeMenu from './AddNodeMenu.jsx';
import { NODE_CONFIG, NODE_TYPES } from '../../constants/nodeTypes.jsx';

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
  onCollapseSidebar
}) => {
  const canvasRef = useRef(null);
  const contentRef = useRef(null);
  const contextMenuRef = useRef(null);
  const draggedNodeRef = useRef(null); // Track dragged node with ref for reliable access in callbacks
  const insertionPreviewRef = useRef(null); // Track insertion preview with ref for reliable access at drop time
  const [draggedNode, setDraggedNode] = useState(null);
  const [connectionStart, setConnectionStart] = useState(null);
  const [tempConnectionEnd, setTempConnectionEnd] = useState(null);
  const [insertionPreview, setInsertionPreview] = useState(null);
  const [commandPressed, setCommandPressed] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ left: 0, top: 0 });
  const [addNodeMenu, setAddNodeMenu] = useState(null);
  const [sourceNodeForMenu, setSourceNodeForMenu] = useState(null);
  const [connectionForMenu, setConnectionForMenu] = useState(null);
  const [nodeInConnectingRange, setNodeInConnectingRange] = useState(null); // Track which node is in range for pulsing
  
  // Pan and Zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);
  
  // Touch state for mobile navigation
  const touchStartRef = useRef(null);
  const lastTapTimeRef = useRef(0);
  const touchPinchDistanceRef = useRef(0);

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

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('nodeType');
    
    if (!nodeType) return;

    const rect = canvasRef.current.getBoundingClientRect();
    // Account for zoom and pan when positioning dropped nodes
    const x = (e.clientX - rect.left - pan.x) / zoom - 100;
    const y = (e.clientY - rect.top - pan.y) / zoom - 50;

    // Check if dropping between two connected nodes
    const isMobile = window.innerWidth <= 768;
    if (insertionPreview) {
      const newNode = onAddNode(nodeType, { x, y });
      
      onInsertNodeBetween(
        newNode.id,
        insertionPreview.from,
        insertionPreview.to
      );
      setInsertionPreview(null);
      if (!isMobile) onNodeSelect(newNode);
    } else {
      const newNode = onAddNode(nodeType, { x, y });
      if (!isMobile) onNodeSelect(newNode);
    }
  };

  const handleCanvasDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    // Check if hovering over a connection line
    const rect = canvasRef.current.getBoundingClientRect();
    // Convert screen coordinates to canvas coordinates
    const canvasX = (e.clientX - rect.left - pan.x) / zoom;
    const canvasY = (e.clientY - rect.top - pan.y) / zoom;

    let hoveredConnection = null;
    for (const conn of connections) {
      const fromNode = nodes.find(n => n.id === conn.from);
      const toNode = nodes.find(n => n.id === conn.to);
      
      if (fromNode && toNode) {
        // Get actual node heights from DOM to match ConnectionLine rendering
        const fromNodeElement = document.querySelector(`[data-node-id="${fromNode.id}"]`);
        const toNodeElement = document.querySelector(`[data-node-id="${toNode.id}"]`);
        
        const fromNodeHeight = fromNodeElement ? fromNodeElement.offsetHeight : 100;
        const toNodeHeight = toNodeElement ? toNodeElement.offsetHeight : 100;
        
        // Calculate cubic bezier control points using actual node heights
        // These must match what ConnectionLine.jsx renders
        const startX = fromNode.position.x + 100;
        const startY = fromNode.position.y + fromNodeHeight; // Bottom of from node
        const endX = toNode.position.x + 100;
        const endY = toNode.position.y; // Top of to node
        
        const deltaY = endY - startY;
        const controlPointOffset = Math.max(Math.abs(deltaY) * 0.5, 50);
        const controlPoint1Y = startY + controlPointOffset;
        const controlPoint2Y = endY - controlPointOffset;
        
        const distance = distanceToCubicBezier(
          canvasX, canvasY,
          startX, startY,
          endX, endY,
          controlPoint1Y,
          controlPoint2Y
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

    canvas.addEventListener('wheel', preventDefaultZoom, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      // Prevent Safari's default touch behaviors (tab opening, etc)
      if (e.touches.length >= 2 || (e.touches.length === 1 && touchStartRef.current)) {
        e.preventDefault();
      }
    }, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', preventDefaultZoom);
      canvas.removeEventListener('touchmove', () => {});
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

  // Helper function to calculate distance between two touch points
  const getTouchDistance = (touches) => {
    if (touches.length < 2) return 0;
    const [touch1, touch2] = touches;
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Touch handlers for mobile navigation
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      // Single touch - start panning
      const touch = e.touches[0];
      
      // Detect double tap to reset zoom
      const now = Date.now();
      if (now - lastTapTimeRef.current < 300) {
        // Double tap detected
        e.preventDefault();
        handleResetView();
        lastTapTimeRef.current = 0;
      } else {
        lastTapTimeRef.current = now;
        
        // Start pan only if not clicking on a node or UI element
        if (e.target === canvasRef.current || e.target === contentRef.current || e.target.classList.contains('canvas-connections')) {
          e.preventDefault();
          touchStartRef.current = {
            x: touch.clientX - pan.x,
            y: touch.clientY - pan.y
          };
          setIsPanning(true);
        }
      }
    } else if (e.touches.length === 2) {
      // Two fingers - prepare for pinch zoom
      e.preventDefault();
      touchPinchDistanceRef.current = getTouchDistance(e.touches);
      touchStartRef.current = null; // Stop panning when pinching
      setIsPanning(false);
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 1 && touchStartRef.current) {
      // Handle connection dragging on touch
      if (connectionStart) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvasRef.current.getBoundingClientRect();
        const canvasX = (touch.clientX - rect.left - pan.x) / zoom;
        const canvasY = (touch.clientY - rect.top - pan.y) / zoom;
        handleConnectionDrag({ x: canvasX, y: canvasY });
      } else {
        // Single touch pan
        e.preventDefault();
        const touch = e.touches[0];
        setPan({
          x: touch.clientX - touchStartRef.current.x,
          y: touch.clientY - touchStartRef.current.y
        });
      }
    } else if (e.touches.length === 2) {
      // Two finger pinch zoom
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches);
      
      if (touchPinchDistanceRef.current > 0) {
        const delta = (currentDistance - touchPinchDistanceRef.current) * 0.01;
        const newZoom = Math.min(Math.max(0.1, zoom + delta), 3);
        
        // Zoom towards center of two fingers
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        
        const rect = canvasRef.current.getBoundingClientRect();
        const x = centerX - rect.left;
        const y = centerY - rect.top;
        
        const zoomPointX = (x - pan.x) / zoom;
        const zoomPointY = (y - pan.y) / zoom;
        
        setPan({
          x: x - zoomPointX * newZoom,
          y: y - zoomPointY * newZoom
        });
        
        setZoom(newZoom);
        touchPinchDistanceRef.current = currentDistance;
      }
    }
  };

  const handleTouchEnd = (e) => {
    // Handle connection completion first (if we're making a connection)
    if (connectionStart && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      
      // Check if the release point is over a connection point
      const elementsAtEnd = document.elementsFromPoint(touch.clientX, touch.clientY);
      let targetNodeId = null;
      
      // Look for a connection point in the elements at this position
      for (const elem of elementsAtEnd) {
        if (elem.classList.contains('node-connection-point')) {
          // Only allow connecting to INPUT connectors (must be input, not output)
          const isInputConnector = elem.classList.contains('input');
          if (!isInputConnector) {
            continue;
          }
          
          // Find the parent node and get its data-node-id or extract from closest .graph-node
          const nodeElem = elem.closest('.graph-node');
          if (nodeElem && nodeElem.dataset.nodeId) {
            targetNodeId = nodeElem.dataset.nodeId;
            break;
          }
        }
      }
      
      // Complete the connection if we found a target, otherwise cancel
      if (targetNodeId) {
        // Convert to number to match connectionStart.nodeId type
        const targetId = Number(targetNodeId);
        if (connectionStart.nodeId !== targetId) {
          handleConnectionEnd(targetId);
        }
      } else {
        setConnectionStart(null);
        setTempConnectionEnd(null);
        setNodeInConnectingRange(null);
      }
    }
    
    if (e.touches.length === 0) {
      // All fingers lifted
      setIsPanning(false);
      touchStartRef.current = null;
      touchPinchDistanceRef.current = 0;
    } else if (e.touches.length === 1) {
      // One finger remains, restart single-touch pan
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX - pan.x,
        y: touch.clientY - pan.y
      };
      touchPinchDistanceRef.current = 0;
    }
  };

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
    draggedNodeRef.current = node; // Keep ref in sync
  };

  const handleNodeDrag = (node, position) => {
    onNodeMove(node.id, { position });
    
    // Check if this node has any existing connections
    const hasConnections = connections.some(conn => conn.from === node.id || conn.to === node.id);
    
    // If node has connections, don't show insertion preview
    if (hasConnections) {
      setInsertionPreview(null);
      insertionPreviewRef.current = null;
      return;
    }
    
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
        // Get actual node heights from DOM
        const fromNodeElement = document.querySelector(`[data-node-id="${fromNode.id}"]`);
        const toNodeElement = document.querySelector(`[data-node-id="${toNode.id}"]`);
        
        const fromNodeHeight = fromNodeElement ? fromNodeElement.offsetHeight : 100;
        const toNodeHeight = toNodeElement ? toNodeElement.offsetHeight : 100;
        
        // Calculate cubic bezier control points using actual node heights
        // These must match what ConnectionLine.jsx renders
        const startX = fromNode.position.x + 100;
        const startY = fromNode.position.y + fromNodeHeight; // Bottom of from node
        const endX = toNode.position.x + 100;
        const endY = toNode.position.y; // Top of to node
        
        const deltaY = endY - startY;
        const controlPointOffset = Math.max(Math.abs(deltaY) * 0.5, 50);
        const controlPoint1Y = startY + controlPointOffset;
        const controlPoint2Y = endY - controlPointOffset;
        
        // Use cubic bezier distance calculation
        const distance = distanceToCubicBezier(
          nodeCenterX,
          nodeCenterY,
          startX,
          startY,
          endX,
          endY,
          controlPoint1Y,
          controlPoint2Y
        );

        if (distance < 30) {
          hoveredConnection = conn;
          break;
        }
      }
    }
    
    setInsertionPreview(hoveredConnection);
    insertionPreviewRef.current = hoveredConnection; // Keep ref in sync
  };

  const handleNodeDragEnd = () => {
    // If we're hovering over a connection, insert the node between
    // Use refs to ensure we have correct values even if state hasn't updated
    const previewToInsert = insertionPreviewRef.current;
    const nodeToInsert = draggedNodeRef.current;
    
    if (previewToInsert && nodeToInsert) {
      // Check if node has any existing connections - if so, don't allow insertion
      const hasConnections = connections.some(conn => conn.from === nodeToInsert.id || conn.to === nodeToInsert.id);
      
      if (!hasConnections) {
        onInsertNodeBetween(
          nodeToInsert.id,
          previewToInsert.from,
          previewToInsert.to
        );
      }
    }
    setDraggedNode(null);
    draggedNodeRef.current = null;
    setInsertionPreview(null);
    insertionPreviewRef.current = null;
  };

  const handleAddNodeBelow = (sourceNode, nodeType) => {
    // If a specific nodeType is provided, create the node immediately
    if (nodeType) {
      const spacing = 120; // Vertical spacing between nodes
      const newPosition = {
        x: sourceNode.position.x,
        y: sourceNode.position.y + spacing
      };

      const newNode = onAddNode(nodeType, newPosition);
      
      // Connect the source node to the new node
      onConnectionCreate(sourceNode.id, newNode.id);
      
      // Select the new node
      onNodeSelect(newNode);
      setAddNodeMenu(null);
      setSourceNodeForMenu(null);
      return;
    }
  };

  const handleAddNodeMenuSelect = (nodeType) => {
    if (sourceNodeForMenu) {
      handleAddNodeBelow(sourceNodeForMenu, nodeType);
    } else if (connectionForMenu) {
      // Calculate a midpoint position for the new node
      const fromNode = nodes.find(n => n.id === connectionForMenu.from);
      const toNode = nodes.find(n => n.id === connectionForMenu.to);
      
      let newPosition = { x: 0, y: 0 };
      if (fromNode && toNode) {
        newPosition = {
          x: (fromNode.position.x + toNode.position.x) / 2,
          // Shift this mid point down just slightly to leave room for the incoming connection arrow maybe, or leave centered
          y: ((fromNode.position.y + toNode.position.y) / 2) + 60
        };
      }
      
      const newNode = onAddNode(nodeType, newPosition);
      
      // Insert between the connection
      if (onInsertNodeBetween) {
        onInsertNodeBetween(newNode.id, connectionForMenu.from, connectionForMenu.to);
      }
      
      // Select the new node
      onNodeSelect(newNode);
      setAddNodeMenu(null);
      setConnectionForMenu(null);
    }
  };

  const handleAddNodeMenuClose = () => {
    setAddNodeMenu(null);
    setSourceNodeForMenu(null);
    setConnectionForMenu(null);
  };

  const handleShowAddNodeMenu = (node, buttonRect) => {
    if (buttonRect && node) {
      setSourceNodeForMenu(node);
      setConnectionForMenu(null); // Ensure we're not inserting between
      setAddNodeMenu({
        x: buttonRect.left + (buttonRect.width / 2) - 100, // Center the 200px menu horizontally under the button
        y: buttonRect.bottom + 8
      });
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
      
      // Check which node (if any) is in connecting range
      const rangeThreshold = 50; // pixels
      let inRangeNodeId = null;
      
      for (const node of nodes) {
        // Skip the source node
        if (node.id === connectionStart.nodeId) continue;
        
        // Skip if this node already has an incoming connection
        const hasIncomingConnection = connections.some(conn => conn.to === node.id);
        if (hasIncomingConnection) continue;
        
        // Calculate distance to this node's input connector (top center)
        const nodeInputX = node.position.x + 100; // Center of node
        const nodeInputY = node.position.y; // Top of node
        
        const dx = position.x - nodeInputX;
        const dy = position.y - nodeInputY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < rangeThreshold) {
          inRangeNodeId = node.id;
          break;
        }
      }
      
      setNodeInConnectingRange(inRangeNodeId);
    }
  };

  const handleConnectionEnd = (targetNodeId, releasePosition = null) => {
    if (connectionStart && targetNodeId && connectionStart.nodeId !== targetNodeId) {
      onConnectionCreate(connectionStart.nodeId, targetNodeId);
      setConnectionStart(null);
      setTempConnectionEnd(null);
      setNodeInConnectingRange(null);
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
      setNodeInConnectingRange(null);
    } else {
      setConnectionStart(null);
      setTempConnectionEnd(null);
      setNodeInConnectingRange(null);
    }
  };

  const handleContextMenuNodeSelect = (nodeType) => {
    if (!contextMenu) return;

    // Create new node at context menu position
    const newNode = onAddNode(nodeType, {
      x: contextMenu.position.x - 100, // Center the node on cursor
      y: contextMenu.position.y
    });

    if (contextMenu.insertBetween) {
      // We're inserting a node between two existing nodes
      const { from, to } = contextMenu.insertBetween;
      // Remove the old connection and create two new ones
      onConnectionRemove(from, to);
      onConnectionCreate(from, newNode.id);
      onConnectionCreate(newNode.id, to);
    } else if (contextMenu.isAddingBelow && contextMenu.sourceNodeId) {
      // We're adding a node below the source node
      onConnectionCreate(contextMenu.sourceNodeId, newNode.id);
    } else if (contextMenu.sourceNodeId) {
      // We're connecting from a source node to the new node
      onConnectionCreate(contextMenu.sourceNodeId, newNode.id);
    }
    
    // Select the new node
    onNodeSelect(newNode);
    
    // Close context menu
    setContextMenu(null);
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleConnectionLineInsertClick = (conn, midX, midY, e) => {
    e.stopPropagation();
    
    // Instead of using contextMenu, we use the unified AddNodeMenu
    const rect = e.target.getBoundingClientRect();
    
    // We can store the connection info in the same state structure or a new one
    // Let's use a new state: setConnectionForMenu(conn) so AddNodeMenu knows what it's inserting between
    setConnectionForMenu(conn);
    setSourceNodeForMenu(null); // Ensure we're not inserting below
    
    // Calculate nicely below the SVG icon circle (r=16, but bounding box includes padding)
    setAddNodeMenu({
      x: rect.left + (rect.width / 2) - 100, // Center the 200px menu
      y: rect.bottom + 8
    });
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

  const distanceToCubicBezier = (px, py, x1, y1, x2, y2, cx1y, cx2y) => {
    // Sample points along the cubic bezier curve and find minimum distance
    // curve formula: B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
    // where P0=(x1,y1), P1=(x1,cx1y), P2=(x2,cx2y), P3=(x2,y2)
    
    let minDistance = Infinity;
    const steps = 20; // Sample 20 points along the curve
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const mt2 = mt * mt;
      const mt3 = mt2 * mt;
      const t2 = t * t;
      const t3 = t2 * t;
      
      // Calculate point on bezier curve
      const bx = mt3 * x1 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x2;
      const by = mt3 * y1 + 3 * mt2 * t * cx1y + 3 * mt * t2 * cx2y + t3 * y2;
      
      // Distance from point to curve sample
      const dx = px - bx;
      const dy = py - by;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < minDistance) {
        minDistance = distance;
      }
    }
    
    return minDistance;
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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={onCollapseSidebar}
      style={{ 
        cursor: isPanning ? 'grabbing' : 'grab',
        touchAction: 'none'
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
              onInsertClick={(midX, midY, e) => handleConnectionLineInsertClick(conn, midX, midY, e)}
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

      {nodes.map(node => {
        // Check if this node has any outgoing connections
        const hasOutgoingConnection = connections.some(conn => conn.from === node.id);
        
        return (
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
            onShowAddNodeMenu={handleShowAddNodeMenu}
            hasOutgoingConnection={hasOutgoingConnection}
            isInConnectingRange={nodeInConnectingRange === node.id}
            onNodeUpdate={onNodeMove}
          />
        );
      })}
      </div>

      {/* Context Menu for Node Selection */}
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

      {/* Zoom Controls */}
      <div className="zoom-controls">
        <button onClick={() => setZoom(z => Math.min(z + 0.1, 2))} title="Zoom In">+</button>
        <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))} title="Zoom Out">-</button>
        <button onClick={handleResetView} title="Reset View">⟲</button>
        <span className="zoom-level">{Math.round(zoom * 100)}%</span>
      </div>

      {/* Add Node Menu */}
      {addNodeMenu && (
        <AddNodeMenu
          position={addNodeMenu}
          onSelectNodeType={handleAddNodeMenuSelect}
          onClose={handleAddNodeMenuClose}
        />
      )}
    </div>
  );
};

export default Canvas;
