import React, { useState, useEffect } from 'react';
import './NodePropertiesPanel.css';
import { NODE_CONFIG, NODE_TYPES } from '../../constants/nodeTypes.jsx';

const NodePropertiesPanel = ({ node, onUpdateNode, onDeleteNode, connections, nodes }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newItem, setNewItem] = useState('');
  const [newTag, setNewTag] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [prevNode, setPrevNode] = useState(null);

  useEffect(() => {
    if (node) {
      setTitle(node.title || '');
      setDescription(node.description || '');
      setIsClosing(false);
      setPrevNode(node);
    } else if (prevNode && !node) {
      // Node was deselected, trigger closing animation
      setIsClosing(true);
    }
  }, [node, prevNode]);

  if (!node && !isClosing) {
    return null;
  }

  const displayNode = node || prevNode;
  if (!displayNode) {
    return (
      <aside className="node-properties-panel-hidden">
      </aside>
    );
  }

  const config = NODE_CONFIG[displayNode.type];
  const dependencies = connections
    .filter(conn => conn.to === displayNode.id)
    .map(conn => conn.from);

  // Calculate available items from all ancestor GET_ITEM nodes
  const getAvailableItems = () => {
    if (!nodes) return [];
    
    const visited = new Set();
    const items = new Set();
    
    const traverse = (nodeId) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      const currentNode = nodes.find(n => n.id === nodeId);
      if (!currentNode) return;
      
      // If it's a GET_ITEM node, add its items
      if (currentNode.type === NODE_TYPES.GET_ITEM && currentNode.items) {
        currentNode.items.forEach(item => items.add(item));
      }
      
      // Traverse parent nodes
      const parents = connections
        .filter(conn => conn.to === nodeId)
        .map(conn => conn.from);
      
      parents.forEach(parentId => traverse(parentId));
    };
    
    traverse(displayNode.id);
    return Array.from(items);
  };

  const availableItems = getAvailableItems();
  const isGetItemNode = displayNode.type === NODE_TYPES.GET_ITEM;

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (node) {
      const updates = { title: newTitle };
      // For GET_ITEM nodes, sync the item name with the title
      if (node.type === NODE_TYPES.GET_ITEM) {
        updates.items = newTitle.trim() ? [newTitle.trim()] : [];
      }
      onUpdateNode(node.id, updates);
    }
  };

  const handleDescriptionChange = (e) => {
    const newDesc = e.target.value;
    setDescription(newDesc);
    if (node) {
      onUpdateNode(node.id, { description: newDesc });
    }
  };

  const handleAddItem = () => {
    if (newItem.trim() && node) {
      onUpdateNode(node.id, {
        items: [...(node.items || []), newItem.trim()]
      });
      setNewItem('');
    }
  };

  const handleRemoveItem = (index) => {
    if (node) {
      const newItems = node.items.filter((_, i) => i !== index);
      onUpdateNode(node.id, { items: newItems });
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && node) {
      onUpdateNode(node.id, {
        tags: [...(node.tags || []), newTag.trim()]
      });
      setNewTag('');
    }
  };

  const handleRemoveTag = (index) => {
    if (node) {
      const newTags = node.tags.filter((_, i) => i !== index);
      onUpdateNode(node.id, { tags: newTags });
    }
  };

  const handleDelete = () => {
    if (node && window.confirm('Are you sure you want to delete this node?')) {
      onDeleteNode(node.id);
    }
  };

  return (
    <aside className={`node-properties-panel ${isClosing ? 'closing' : ''}`}>
      <div className="panel-header">
        <h3>Node Properties</h3>
        <button className="delete-button" onClick={handleDelete} title="Delete node">
          🗑️
        </button>
      </div>

      <div className="panel-section">
        <label className="panel-label">Type</label>
        <div className="node-type-display" style={{ backgroundColor: config.color }}>
          <img src={config.icon} alt={config.label} className="node-type-icon" />
          <span>{config.label}</span>
        </div>
      </div>

      <div className="panel-section">
        <label className="panel-label" htmlFor="node-title">Title</label>
        <input
          id="node-title"
          type="text"
          className="panel-input"
          value={title}
          onChange={handleTitleChange}
          placeholder={config.defaultTitle}
        />
      </div>

      <div className="panel-section">
        <label className="panel-label" htmlFor="node-description">Description</label>
        <textarea
          id="node-description"
          className="panel-textarea"
          value={description}
          onChange={handleDescriptionChange}
          placeholder="Add a description..."
          rows={4}
        />
      </div>

      {isGetItemNode ? (
        <div className="panel-section">
          <label className="panel-label">Item Obtained</label>
          <p className="panel-hint">This item will be available in all future connected nodes</p>
          <div className="items-list">
            {displayNode.items?.map((item, index) => (
              <div key={index} className="item-chip">
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        availableItems.length > 0 && (
          <div className="panel-section">
            <label className="panel-label">Available Items</label>
            <p className="panel-hint">Items collected from previous nodes</p>
            <div className="items-list">
              {availableItems.map((item, index) => (
                <div key={index} className="item-chip item-chip-readonly">
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      <div className="panel-section">
        <label className="panel-label">Tags</label>
        <div className="items-list">
          {displayNode.tags?.map((tag, index) => (
            <div key={index} className="item-chip tag-chip">
              <span>{tag}</span>
              <button onClick={() => handleRemoveTag(index)}>×</button>
            </div>
          ))}
        </div>
        <div className="add-item-form input-with-icon">
          <input
            type="text"
            className="panel-input"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
            placeholder="Add tag..."
          />
          <button className="input-icon-button" onClick={handleAddTag} title="Add tag">
            <img src="/icons/add.svg" alt="Add" />
          </button>
        </div>
      </div>

      {dependencies.length > 0 && (
        <div className="panel-section">
          <label className="panel-label">Dependencies</label>
          <div className="dependencies-count">
            {dependencies.length} node{dependencies.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </aside>
  );
};

export default NodePropertiesPanel;
