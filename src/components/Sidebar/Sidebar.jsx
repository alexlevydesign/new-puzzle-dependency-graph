import React from 'react';
import './Sidebar.css';
import { NODE_TYPES, NODE_CONFIG } from '../../constants/nodeTypes.jsx';
import NodeTypeButton from './NodeTypeButton.jsx';

const Sidebar = ({ isExpanded, onExpand }) => {
  return (
    <aside 
      className={`sidebar ${isExpanded ? 'sidebar-expanded' : ''}`}
      onMouseEnter={onExpand}
    >
      <div className="sidebar-node-list">
        <NodeTypeButton
          type={NODE_TYPES.PLAYER_ACTION}
          config={NODE_CONFIG[NODE_TYPES.PLAYER_ACTION]}
        />
        <NodeTypeButton
          type={NODE_TYPES.CHARACTER_ACTION}
          config={NODE_CONFIG[NODE_TYPES.CHARACTER_ACTION]}
        />
        <NodeTypeButton
          type={NODE_TYPES.GET_ITEM}
          config={NODE_CONFIG[NODE_TYPES.GET_ITEM]}
        />
        <NodeTypeButton
          type={NODE_TYPES.USE_ITEM}
          config={NODE_CONFIG[NODE_TYPES.USE_ITEM]}
        />
        <NodeTypeButton
          type={NODE_TYPES.GOAL}
          config={NODE_CONFIG[NODE_TYPES.GOAL]}
        />
        <NodeTypeButton
          type={NODE_TYPES.STORY_STATE}
          config={NODE_CONFIG[NODE_TYPES.STORY_STATE]}
        />
      </div>
    </aside>
  );
};

export default Sidebar;
