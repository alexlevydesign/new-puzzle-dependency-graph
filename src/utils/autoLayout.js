/**
 * Automatic graph layout utilities
 * Implements a vertical list layout with branching support for dependency graphs
 */

const NODE_SPACING_Y = 180; // Vertical spacing between nodes
const NODE_SPACING_X = 250; // Horizontal spacing for branches
const NODE_WIDTH = 200; // Standard node width
const START_X = 400; // X position for main column
const START_Y = 100; // Starting Y position

/**
 * Calculate automatic layout positions for all nodes based on their order and connections
 * @param {Array} nodes - Array of node objects (order matters)
 * @param {Array} connections - Array of connection objects {from, to}
 * @returns {Object} Map of node IDs to {x, y} positions
 */
export function calculateAutoLayout(nodes, connections) {
  if (nodes.length === 0) return {};

  const positions = {};
  const processed = new Set();
  
  // Build connection maps for quick lookup
  const childrenMap = {}; // nodeId -> [child node ids]
  const parentMap = {}; // nodeId -> parent node id
  
  connections.forEach(conn => {
    if (!childrenMap[conn.from]) childrenMap[conn.from] = [];
    childrenMap[conn.from].push(conn.to);
    parentMap[conn.to] = conn.from;
  });
  
  // Track which Y positions are used for each column
  const columnYPositions = {}; // column index -> [occupied Y positions]
  
  // Helper to find next available Y position in a column
  const getNextYInColumn = (columnIndex, preferredY) => {
    if (!columnYPositions[columnIndex]) {
      columnYPositions[columnIndex] = [];
    }
    
    let y = preferredY;
    // Check if preferred Y is occupied, if so, find next available
    while (columnYPositions[columnIndex].includes(y)) {
      y += NODE_SPACING_Y;
    }
    
    columnYPositions[columnIndex].push(y);
    return y;
  };
  
  // Position nodes in order, detecting branches
  nodes.forEach((node, index) => {
    if (processed.has(node.id)) return;
    
    const children = childrenMap[node.id] || [];
    const parent = parentMap[node.id];
    
    // Check if this node has a parent
    if (parent && positions[parent]) {
      // This node has a parent that's already positioned
      const parentPos = positions[parent];
      const parentChildren = childrenMap[parent] || [];
      
      // If parent has multiple children, this is a branch
      if (parentChildren.length > 1) {
        // Find which child number this is (0 = main line, 1+ = branches)
        const childIndex = parentChildren.indexOf(node.id);
        
        if (childIndex === 0) {
          // First child continues the main line
          const y = getNextYInColumn(0, parentPos.y + NODE_SPACING_Y);
          positions[node.id] = { x: START_X, y };
        } else {
          // Subsequent children are branches to the right
          const branchColumn = childIndex;
          const x = START_X + (branchColumn * NODE_SPACING_X);
          const y = getNextYInColumn(branchColumn, parentPos.y + NODE_SPACING_Y);
          positions[node.id] = { x, y };
        }
      } else {
        // Single child, continue in same column as parent
        const parentColumn = Math.round((parentPos.x - START_X) / NODE_SPACING_X);
        const y = getNextYInColumn(parentColumn, parentPos.y + NODE_SPACING_Y);
        positions[node.id] = { x: parentPos.x, y };
      }
    } else {
      // No parent or parent not yet positioned - this is a root node or sequential node
      // Place in main column at next available Y
      const y = getNextYInColumn(0, START_Y + (index * NODE_SPACING_Y));
      positions[node.id] = { x: START_X, y };
    }
    
    processed.add(node.id);
  });

  return positions;
}

/**
 * Reorder nodes array by moving a node to a new position
 * @param {Array} nodes - Current nodes array
 * @param {number} fromIndex - Current index of the node
 * @param {number} toIndex - Target index
 * @returns {Array} New nodes array with reordered nodes
 */
export function reorderNodes(nodes, fromIndex, toIndex) {
  const result = Array.from(nodes);
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

/**
 * Find the insertion index for a dragged node based on Y position
 * @param {number} draggedNodeId - ID of the node being dragged
 * @param {number} dragY - Current Y position of dragged node
 * @param {Array} nodes - All nodes
 * @returns {number} Target index for insertion
 */
export function findInsertionIndex(draggedNodeId, dragY, nodes) {
  const draggedIndex = nodes.findIndex(n => n.id === draggedNodeId);
  if (draggedIndex === -1) return 0;

  const NODE_HEIGHT = 100; // Approximate node height
  
  // Find which position the dragged node should be inserted at based on Y position
  let targetIndex = draggedIndex; // Default to current position (no move)
  
  // Calculate the center Y of the dragged node
  const draggedCenterY = dragY + 50; // Add half the approximate node height
  
  // Find where this Y position falls in the list
  // Only reorder if the center passes completely beyond a node's boundary
  for (let i = 0; i < nodes.length; i++) {
    if (i === draggedIndex) continue; // Skip self
    
    const nodeY = START_Y + (i * NODE_SPACING_Y);
    const nodeTop = nodeY;
    const nodeBottom = nodeY + NODE_HEIGHT;
    
    // Moving up: dragged center must pass above the top of the target node
    if (i < draggedIndex && draggedCenterY < nodeTop) {
      targetIndex = i;
      break;
    }
    
    // Moving down: dragged center must pass below the bottom of the target node
    if (i > draggedIndex && draggedCenterY > nodeBottom) {
      targetIndex = i;
    }
  }

  // Clamp to valid range
  targetIndex = Math.max(0, Math.min(targetIndex, nodes.length - 1));

  return targetIndex;
}
