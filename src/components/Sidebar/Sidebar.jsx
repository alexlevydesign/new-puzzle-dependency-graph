import React from 'react';
import './Sidebar.css';
import { NODE_TYPES, NODE_CONFIG } from '../../constants/nodeTypes.jsx';
import NodeTypeButton from './NodeTypeButton.jsx';

const Sidebar = ({ onNodeTypeSelect, onUndo, onRedo, canUndo, canRedo }) => {
  const handleDragStart = (e, nodeType) => {
    e.dataTransfer.setData('nodeType', nodeType);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-actions">
          <button className="option-button sidebar-action-button">Options

            <img src="/icons/options.svg" alt="Options" />
          </button>
        <div className="sidebar-action-buttons">
          <button 
            className="sidebar-action-button" 
            onClick={onUndo} 
            disabled={!canUndo}
            title="Undo (Cmd+Z)"
          >
            <img src="/icons/undo.svg" alt="Undo" />
          </button>

          <div className="vertical-rule">

          </div>

          <button 
            className="sidebar-action-button" 
            onClick={onRedo} 
            disabled={!canRedo}
            title="Redo (Cmd+Shift+Z)"
          >
            <img src="/icons/redo.svg" alt="Redo" />
          </button>
        </div>
      </div>

      <div className="sidebar-section">
        <h3 className="sidebar-section-title">Action nodes</h3>
        <div className="sidebar-node-list">
          <NodeTypeButton
            type={NODE_TYPES.PLAYER_ACTION}
            config={NODE_CONFIG[NODE_TYPES.PLAYER_ACTION]}
            onDragStart={handleDragStart}
          />
          <NodeTypeButton
            type={NODE_TYPES.CHARACTER_ACTION}
            config={NODE_CONFIG[NODE_TYPES.CHARACTER_ACTION]}
            onDragStart={handleDragStart}
          />
          <NodeTypeButton
            type={NODE_TYPES.GET_ITEM}
            config={NODE_CONFIG[NODE_TYPES.GET_ITEM]}
            onDragStart={handleDragStart}
          />
          <NodeTypeButton
            type={NODE_TYPES.USE_ITEM}
            config={NODE_CONFIG[NODE_TYPES.USE_ITEM]}
            onDragStart={handleDragStart}
          />
        </div>
      </div>

      <div className="sidebar-section">
        <h3 className="sidebar-section-title">Progress nodes</h3>
        <div className="sidebar-node-list">
          <NodeTypeButton
            type={NODE_TYPES.GOAL}
            config={NODE_CONFIG[NODE_TYPES.GOAL]}
            onDragStart={handleDragStart}
          />
          <NodeTypeButton
            type={NODE_TYPES.STORY_STATE}
            config={NODE_CONFIG[NODE_TYPES.STORY_STATE]}
            onDragStart={handleDragStart}
          />
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
