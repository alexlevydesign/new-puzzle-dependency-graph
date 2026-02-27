# Auto-Layout Feature

## Overview
The graph now uses **automatic vertical layout** to position nodes in a clean, organized list. Nodes are arranged vertically with consistent spacing, and you can reorder them by dragging or using keyboard shortcuts.

## How It Works

### Automatic Positioning
- Nodes are organized in a **vertical list** with 180px spacing between each node
- All nodes are horizontally centered at the same X position (400px)
- The list starts at Y position 100px from the top
- Order is determined by the array index, not by dependencies

### Drag-to-Reorder
You can reorder nodes by dragging them up or down in the list:

1. **Click and drag a node** - It will show visual feedback (becomes semi-transparent)
2. **Drag up or down** - A blue insertion line appears showing where the node will be placed
3. **Release the node** - It will be inserted at the new position
   - All other nodes automatically adjust their positions
   - Smooth 0.3s animation transitions

### Keyboard Reordering
When a node is selected, use arrow keys to move it:

- **Arrow Up (↑)** - Move the selected node up one position in the list
- **Arrow Down (↓)** - Move the selected node down one position in the list

This provides precise control without using the mouse.

### Adding New Nodes
When you add a new node:
- It's added to the end of the list
- The layout automatically recalculates
- All nodes smoothly animate to their positions

### Layout Algorithm
The system uses a simple vertical list layout:
- **Y Position**: `100 + (index × 180)`
- **X Position**: `400` (constant for all nodes)
- **Spacing**: 180px between each node
- **Insertion**: Calculated based on dragged Y position and node midpoints

## Visual Feedback

- **Dragging**: Node becomes semi-transparent (70% opacity) with enhanced shadow
- **Insertion Indicator**: Blue horizontal line (4px thick) shows where node will be inserted
- **Position Transitions**: Nodes smoothly animate to new positions (0.3s ease)
- **Selection**: Selected nodes show blue border and shadow

## Keyboard Shortcuts

- **↑** (Arrow Up) - Move selected node up in the list
- **↓** (Arrow Down) - Move selected node down in the list  
- **Cmd/Ctrl + Z** - Undo
- **Cmd/Ctrl + Shift + Z** - Redo

## Benefits

1. **Always Organized**: Consistent vertical spacing and alignment
2. **Easy Reordering**: Drag or keyboard shortcuts for quick reorganization
3. **Visual Clarity**: Clean, uncluttered layout with clear insertion feedback
4. **Scales Well**: Works with any number of nodes
5. **Predictable**: Simple top-to-bottom ordering that's easy to understand
