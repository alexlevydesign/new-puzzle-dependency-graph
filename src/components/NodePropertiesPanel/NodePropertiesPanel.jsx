import React, { useState, useEffect } from 'react';
import './NodePropertiesPanel.css';
import { NODE_CONFIG, NODE_TYPES } from '../../constants/nodeTypes.jsx';

const NodePropertiesPanel = ({ node, onUpdateNode, onDeleteNode, connections, nodes }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newItem, setNewItem] = useState('');
  const [newTag, setNewTag] = useState('');
  const [tags, setTags] = useState([]);
  const [isClosing, setIsClosing] = useState(false);
  const [prevNode, setPrevNode] = useState(null);

  useEffect(() => {
    if (node) {
      setTitle(node.title || '');
      setDescription(node.description || '');
      setTags(node.tags || []);
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

  // Ensure we reference the latest node data from the nodes array (sync after updates)
  const currentNode = nodes?.find(n => n.id === displayNode.id) || displayNode;

  const config = NODE_CONFIG[displayNode.type];
  const dependencies = connections
    .filter(conn => conn.to === displayNode.id)
    .map(conn => conn.from);

  // Calculate available items from all ancestor GET_ITEM nodes (applying USE_ITEM filters along path)
  const getAvailableItems = () => {
    if (!nodes) return [];

    const memo = new Map();
    const visiting = new Set();

    const itemsForNode = (nodeId) => {
      if (memo.has(nodeId)) return memo.get(nodeId);
      if (visiting.has(nodeId)) return new Set(); // break cycles
      visiting.add(nodeId);

      const current = nodes.find(n => n.id === nodeId);
      if (!current) {
        visiting.delete(nodeId);
        return new Set();
      }

      // Start with items produced by this node (if GET_ITEM)
      const items = new Set();
      if (current.type === NODE_TYPES.GET_ITEM && Array.isArray(current.items)) {
        current.items.forEach(i => {
          if (i && i.toString().trim()) items.add(i.toString().trim());
        });
      }

      // Merge items from all parent nodes
      const parents = connections
        .filter(conn => conn.to === nodeId)
        .map(conn => conn.from);

      parents.forEach(pid => {
        const parentItems = itemsForNode(pid);
        parentItems.forEach(i => items.add(i));
      });

      // If this node is a USE_ITEM node and it has an explicit items array,
      // treat it as a filter: only items present in current.items remain available downstream.
      let result = items;
      if (current.type === NODE_TYPES.USE_ITEM) {
        if (Array.isArray(current.items)) {
          if (current.items.length === 0) {
            // user explicitly deselected all items at this node -> nothing passes
            result = new Set();
          } else {
            const allowed = new Set(current.items.map(i => i.toString().trim()));
            result = new Set(Array.from(items).filter(i => allowed.has(i)));
          }
        } else {
          // no explicit selection on this USE_ITEM node -> default: allow all
          result = items;
        }
      }

      memo.set(nodeId, result);
      visiting.delete(nodeId);
      return result;
    };

    const finalSet = itemsForNode(displayNode.id);
    return Array.from(finalSet).sort((a, b) => a.localeCompare(b));
  };

  // Compute upstream items for UI on USE_ITEM nodes (do not apply current node's USE_ITEM filter)
  const getUpstreamItems = () => {
    if (!nodes) return [];

    const memo = new Map();
    const visiting = new Set();

    const itemsFromParents = (nodeId) => {
      if (memo.has(nodeId)) return memo.get(nodeId);
      if (visiting.has(nodeId)) return new Set();
      visiting.add(nodeId);

      const current = nodes.find(n => n.id === nodeId);
      if (!current) {
        visiting.delete(nodeId);
        return new Set();
      }

      // Merge items from all parent nodes
      const items = new Set();
      const parents = connections
        .filter(conn => conn.to === nodeId)
        .map(conn => conn.from);

      parents.forEach(pid => {
        const parentItems = itemsFromParents(pid);
        parentItems.forEach(i => items.add(i));
      });

      // Also include this node's GET_ITEM outputs
      if (current.type === NODE_TYPES.GET_ITEM && Array.isArray(current.items)) {
        current.items.forEach(i => {
          if (i && i.toString().trim()) items.add(i.toString().trim());
        });
      }

      memo.set(nodeId, items);
      visiting.delete(nodeId);
      return items;
    };

    // For the displayNode's upstream, compute from its parents (not including displayNode itself)
    const parents = connections
      .filter(conn => conn.to === displayNode.id)
      .map(conn => conn.from);

    const upstreamSet = new Set();
    parents.forEach(pid => {
      const set = itemsFromParents(pid);
      set.forEach(i => upstreamSet.add(i));
    });

    return Array.from(upstreamSet).sort((a, b) => a.localeCompare(b));
  };

  const availableItems = getAvailableItems();
  const upstreamItems = getUpstreamItems();
  const isGetItemNode = displayNode.type === NODE_TYPES.GET_ITEM;
  const isUseItemNode = displayNode.type === NODE_TYPES.USE_ITEM;

  const handleToggleUseItem = (item) => {
    if (!displayNode) return;
    const initialized = !!currentNode?.itemsSelectionInitialized;
    const baseSelection = (initialized && Array.isArray(currentNode?.items)) ? [...currentNode.items] : [...upstreamItems];
    const exists = baseSelection.includes(item);
    const newItems = exists ? baseSelection.filter(i => i !== item) : [...baseSelection, item];
    onUpdateNode(displayNode.id, { items: newItems, itemsSelectionInitialized: true });
  };

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (displayNode) {
      const updates = { title: newTitle };
      // For GET_ITEM nodes, sync the item name with the title
      if (displayNode.type === NODE_TYPES.GET_ITEM) {
        updates.items = newTitle.trim() ? [newTitle.trim()] : [];
      }
      onUpdateNode(displayNode.id, updates);
    }
  };

  const handleDescriptionChange = (e) => {
    const newDesc = e.target.value;
    setDescription(newDesc);
    if (displayNode) {
      onUpdateNode(displayNode.id, { description: newDesc });
    }
  };

  const handleAddItem = () => {
    if (newItem.trim() && displayNode) {
      const baseItems = Array.isArray(currentNode?.items) ? [...currentNode.items] : [];
      onUpdateNode(displayNode.id, {
        items: [...baseItems, newItem.trim()]
      });
      setNewItem('');
    }
  };

  const handleRemoveItem = (index) => {
    if (displayNode) {
      const baseItems = Array.isArray(currentNode?.items) ? [...currentNode.items] : [];
      const newItems = baseItems.filter((_, i) => i !== index);
      onUpdateNode(displayNode.id, { items: newItems });
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && displayNode) {
      const updatedTags = [...tags, newTag.trim()];
      setTags(updatedTags);
      onUpdateNode(displayNode.id, {
        tags: updatedTags
      });
      setNewTag('');
    }
  };

  const handleRemoveTag = (index) => {
    if (displayNode) {
      const updatedTags = tags.filter((_, i) => i !== index);
      setTags(updatedTags);
      onUpdateNode(displayNode.id, { tags: updatedTags });
    }
  };

  const handleDelete = () => {
    if (displayNode && window.confirm('Are you sure you want to delete this node?')) {
      onDeleteNode(displayNode.id);
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

          <div className="add-item-form input-with-icon">
            <input
              type="text"
              className="panel-input"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
              placeholder="Add item..."
            />
            <button className="input-icon-button" onClick={handleAddItem} title="Add item">
              <img src="/icons/add.svg" alt="Add" />
            </button>
          </div>

          <div className="items-list">
            {(currentNode?.items || displayNode.items || []).map((item, index) => (
              <div key={index} className="item-chip">
                <span>{item}</span>
                <button className="remove-button" onClick={() => handleRemoveItem(index)} title="Remove item">
                  <img src="/icons/close.svg" alt="Remove" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : isUseItemNode ? (
        <div className="panel-section">
          <label className="panel-label">Use Item</label>
          <p className="panel-hint">Toggle items to use at this node (turn off if item breaks)</p>
          {upstreamItems.length === 0 ? (
            <div className="panel-note">No available items from previous nodes.</div>
          ) : (
            <div className="items-list">
              {upstreamItems.map((item, index) => {
                const initialized = !!currentNode?.itemsSelectionInitialized;
                const checked = initialized ? (Array.isArray(currentNode?.items) ? currentNode.items.includes(item) : false) : true; // default on when not initialized
                return (
                  <div key={index} className={`item-chip use-item-chip ${checked ? 'active' : ''}`} onClick={() => handleToggleUseItem(item)}>
                    <input type="checkbox" checked={checked} readOnly />
                    <span>{item}</span>
                  </div>
                );
              })}
            </div>
          )}
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
        <div className="items-list">
          {tags.map((tag, index) => (
            <div key={index} className="item-chip tag-chip">
              <span>{tag}</span>
              <button onClick={() => handleRemoveTag(index)} className="remove-button">
                <img src="/icons/close.svg" alt="Remove" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {dependencies.length > 0 && (
        <div className="panel-section">
          <label className="panel-label">Dependencies</label>
          <div className="items-list">
            {dependencies.map((depId) => {
              const depNode = nodes?.find(n => n.id === depId);
              return (
                <div key={depId} className="item-chip dependency-chip">
                  <span>{depNode ? depNode.title : `Node ${depId}`}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
};

export default NodePropertiesPanel;
