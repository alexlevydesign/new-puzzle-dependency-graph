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
  const [selectedUseItem, setSelectedUseItem] = useState('');
  const [removeAfterUse, setRemoveAfterUse] = useState(false);

  // ALL hooks must be called unconditionally, BEFORE any early returns
  useEffect(() => {
    if (node) {
      setTitle(node.title || '');
      setDescription(node.description || '');
      setTags(node.tags || []);
      setIsClosing(false);
      setPrevNode(node);
      // Restore use-item state from node data if it's a USE_ITEM node
      if (node.type === NODE_TYPES.USE_ITEM) {
        setSelectedUseItem(node.selectedUseItem || '');
        setRemoveAfterUse(node.removeAfterUse || false);
      } else {
        setSelectedUseItem('');
        setRemoveAfterUse(false);
      }
    } else if (prevNode && !node) {
      // Node was deselected, trigger closing animation
      setIsClosing(true);
    }
  }, [node, prevNode]);

  // Auto-initialize USE_ITEM nodes with upstream items BEFORE early returns
  useEffect(() => {
    if (!node || node.type !== NODE_TYPES.USE_ITEM || !nodes) return;
    
    // Only auto-initialize if user has NOT explicitly set items yet (itemsSelectionInitialized flag)
    if (!node.itemsSelectionInitialized && (!Array.isArray(node.items) || node.items.length === 0)) {
      // We need to compute upstream items to initialize with
      const memo = new Map();
      const visiting = new Set();
      
      const getUpstream = (nodeId) => {
        if (memo.has(nodeId)) return memo.get(nodeId);
        if (visiting.has(nodeId)) return new Set();
        visiting.add(nodeId);

        const items = new Set();
        const parents = connections
          .filter(conn => conn.to === nodeId)
          .map(conn => conn.from);

        parents.forEach(pid => {
          const parent = nodes.find(n => n.id === pid);
          if (parent) {
            const parentItems = getUpstream(pid);
            parentItems.forEach(i => items.add(i));
            
            if (parent.type === NODE_TYPES.GET_ITEM && Array.isArray(parent.items)) {
              parent.items.forEach(i => {
                if (i && i.toString().trim()) items.add(i.toString().trim());
              });
            }
          }
        });

        memo.set(nodeId, items);
        visiting.delete(nodeId);
        return items;
      };

      const upstream = getUpstream(node.id);
      if (upstream.size > 0) {
        onUpdateNode(node.id, { items: Array.from(upstream) });
      }
    }
  }, [node?.id, node?.type, nodes, connections, onUpdateNode]);

  // Early returns must happen AFTER all hooks
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
  // For convergence nodes, an item is only available if it exists on ALL paths reaching that node
  const getAvailableItems = () => {
    if (!nodes) return [];

    const visiting = new Set();

    // Compute items available through each parent path independently, then intersect
    const itemsForNode = (nodeId, memo = new Map()) => {
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

      // Get parent nodes
      const parents = connections
        .filter(conn => conn.to === nodeId)
        .map(conn => conn.from);

      if (parents.length === 0) {
        // No parents - just return items from this node
        let result = items;
        if (current.type === NODE_TYPES.USE_ITEM) {
          // A USE_ITEM's items array represents items the user explicitly selected/deselected
          if (Array.isArray(current.items) && current.items.length > 0) {
            // User made explicit selections
            const allowed = new Set(current.items.map(i => i.toString().trim()));
            result = new Set(Array.from(items).filter(i => allowed.has(i)));
          } else if (Array.isArray(current.items) && current.items.length === 0) {
            // User explicitly deselected ALL items
            result = new Set();
          } else {
            // No explicit selection made - allow all items
            result = items;
          }
          
          // If an item is marked for removal after use, remove it from downstream
          if (current.removeAfterUse && current.selectedUseItem) {
            result.delete(current.selectedUseItem);
          }
        }
        memo.set(nodeId, result);
        visiting.delete(nodeId);
        return result;
      }

      // For each parent, compute items available through that path
      const pathItemSets = parents.map(pid => {
        const parentItems = itemsForNode(pid, memo);
        
        // Merge with items from this node
        const combined = new Set(parentItems);
        if (current.type === NODE_TYPES.GET_ITEM && Array.isArray(current.items)) {
          current.items.forEach(i => {
            if (i && i.toString().trim()) combined.add(i.toString().trim());
          });
        }

        // Apply USE_ITEM filtering only if current is a USE_ITEM node
        let result = combined;
        if (current.type === NODE_TYPES.USE_ITEM) {
          // A USE_ITEM's items array represents items the user explicitly selected/deselected
          // We should only filter out items the user explicitly turned OFF
          // New items that didn't exist when selections were made should pass through
          if (Array.isArray(current.items) && current.items.length > 0) {
            // User made explicit selections. Only exclude items that the user explicitly turned off.
            // An item was explicitly turned off if it's not in the items array AND it's a known item
            // (i.e., items that were available at the time the user made selections).
            // The safest approach: only items in current.items array pass through
            const allowed = new Set(current.items.map(i => i.toString().trim()));
            result = new Set(Array.from(combined).filter(i => allowed.has(i)));
          } else if (Array.isArray(current.items) && current.items.length === 0) {
            // User explicitly deselected ALL items
            result = new Set();
          } else {
            // No explicit selection made - allow all items
            result = combined;
          }
          
          // If an item is marked for removal after use, remove it from downstream
          if (current.removeAfterUse && current.selectedUseItem) {
            result.delete(current.selectedUseItem);
          }
        }

        return result;
      });

      // For convergence nodes (multiple parents), only items present on ALL paths are available
      let finalResult = pathItemSets.length > 1
        ? new Set(Array.from(pathItemSets[0]).filter(item => 
            pathItemSets.every(set => set.has(item))
          ))
        : (pathItemSets[0] || new Set());

      memo.set(nodeId, finalResult);
      visiting.delete(nodeId);
      return finalResult;
    };

    const finalSet = itemsForNode(displayNode.id);
    return Array.from(finalSet).sort((a, b) => a.localeCompare(b));
  };

  // Compute upstream items for UI on USE_ITEM nodes (apply filtering and removal from upstream USE_ITEM nodes)
  // For convergence nodes, an item is only available if it exists on ALL paths reaching that node
  const getUpstreamItems = () => {
    if (!nodes) return [];

    const visiting = new Set();

    const itemsFromParents = (nodeId, memo = new Map()) => {
      if (memo.has(nodeId)) return memo.get(nodeId);
      if (visiting.has(nodeId)) return new Set();
      visiting.add(nodeId);

      const current = nodes.find(n => n.id === nodeId);
      if (!current) {
        visiting.delete(nodeId);
        return new Set();
      }

      // Get parent nodes
      const parents = connections
        .filter(conn => conn.to === nodeId)
        .map(conn => conn.from);

      if (parents.length === 0) {
        // No parents - just return items from this node
        const items = new Set();
        if (current.type === NODE_TYPES.GET_ITEM && Array.isArray(current.items)) {
          current.items.forEach(i => {
            if (i && i.toString().trim()) items.add(i.toString().trim());
          });
        }
        let result = items;
        if (current.type === NODE_TYPES.USE_ITEM) {
          // A USE_ITEM's items array represents items the user explicitly selected/deselected
          if (Array.isArray(current.items) && current.items.length > 0) {
            // User made explicit selections
            const allowed = new Set(current.items.map(i => i.toString().trim()));
            result = new Set(Array.from(items).filter(i => allowed.has(i)));
          } else if (Array.isArray(current.items) && current.items.length === 0) {
            // User explicitly deselected ALL items
            result = new Set();
          } else {
            // No explicit selection made - allow all items
            result = items;
          }
          
          // If an item is marked for removal after use, remove it from downstream
          if (current.removeAfterUse && current.selectedUseItem) {
            result.delete(current.selectedUseItem);
          }
        }
        memo.set(nodeId, result);
        visiting.delete(nodeId);
        return result;
      }

      // For each parent, compute items available through that path
      const pathItemSets = parents.map(pid => {
        const parentItems = itemsFromParents(pid, memo);
        
        // Merge with items from this node
        const combined = new Set(parentItems);
        if (current.type === NODE_TYPES.GET_ITEM && Array.isArray(current.items)) {
          current.items.forEach(i => {
            if (i && i.toString().trim()) combined.add(i.toString().trim());
          });
        }

        // Apply USE_ITEM filtering only if current is a USE_ITEM node
        let result = combined;
        if (current.type === NODE_TYPES.USE_ITEM) {
          // A USE_ITEM's items array represents items the user explicitly selected/deselected
          // We should only filter out items the user explicitly turned OFF
          // New items that didn't exist when selections were made should pass through
          if (Array.isArray(current.items) && current.items.length > 0) {
            // User made explicit selections. Only exclude items that the user explicitly turned off.
            const allowed = new Set(current.items.map(i => i.toString().trim()));
            result = new Set(Array.from(combined).filter(i => allowed.has(i)));
          } else if (Array.isArray(current.items) && current.items.length === 0) {
            // User explicitly deselected ALL items
            result = new Set();
          } else {
            // No explicit selection made - allow all items
            result = combined;
          }
          
          // If an item is marked for removal after use, remove it from downstream
          if (current.removeAfterUse && current.selectedUseItem) {
            result.delete(current.selectedUseItem);
          }
        }

        return result;
      });

      // For convergence nodes (multiple parents), only items present on ALL paths are available
      let finalResult = pathItemSets.length > 1
        ? new Set(Array.from(pathItemSets[0]).filter(item => 
            pathItemSets.every(set => set.has(item))
          ))
        : (pathItemSets[0] || new Set());

      memo.set(nodeId, finalResult);
      visiting.delete(nodeId);
      return finalResult;
    };

    // For the displayNode's upstream, compute from its parents (not including displayNode itself)
    const parents = connections
      .filter(conn => conn.to === displayNode.id)
      .map(conn => conn.from);

    if (parents.length === 0) {
      return [];
    }

    // For convergence nodes, compute each parent path and intersect
    const pathItemSets = parents.map(pid => itemsFromParents(pid));
    
    const upstreamSet = parents.length > 1
      ? new Set(Array.from(pathItemSets[0]).filter(item => 
          pathItemSets.every(set => set.has(item))
        ))
      : pathItemSets[0];

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

  const handleUseItemSelect = (itemName) => {
    setSelectedUseItem(itemName);
    setRemoveAfterUse(false);
    
    // If we're switching from a previous item that was marked for removal, 
    // restore it to the inventory
    let updatedItems = Array.isArray(currentNode?.items) ? [...currentNode.items] : [];
    
    if (selectedUseItem && currentNode?.removeAfterUse && !updatedItems.includes(selectedUseItem)) {
      // Add back the previously removed item
      updatedItems.push(selectedUseItem);
    }
    
    // Initialize items list with all upstream items if not already set
    if (updatedItems.length === 0) {
      updatedItems = [...upstreamItems];
    }
    
    onUpdateNode(displayNode.id, { 
      items: updatedItems,
      selectedUseItem: itemName,
      removeAfterUse: false
    });
  };

  const handleRemoveAfterUseChange = (checked) => {
    setRemoveAfterUse(checked);
    if (displayNode && selectedUseItem) {
      if (checked) {
        // Remove the selected item from the items list
        const newItems = (currentNode?.items || []).filter(item => item !== selectedUseItem);
        onUpdateNode(displayNode.id, { 
          items: newItems,
          removeAfterUse: checked
        });
      } else {
        // Add the selected item back to the items list
        const newItems = Array.isArray(currentNode?.items) ? [...currentNode.items] : [];
        if (!newItems.includes(selectedUseItem)) {
          newItems.push(selectedUseItem);
          onUpdateNode(displayNode.id, { 
            items: newItems,
            removeAfterUse: checked
          });
        } else {
          onUpdateNode(displayNode.id, { removeAfterUse: checked });
        }
      }
    }
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
        <>
          <div className="panel-section">
            <label className="panel-label">Inventory</label>
            <p className="panel-hint">The items collected up to this point</p>
            <div className="items-list">
              {upstreamItems.map((item, index) => (
                <div key={index} className="item-chip item-chip-readonly">
                  <span>{item}</span>
                </div>
              ))}
              {(currentNode?.items || displayNode.items || []).map((item, index) => (
                <div key={`new-${index}`} className="item-chip item-chip-readonly item-chip-highlighted">
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : isUseItemNode ? (
        <>
          <div className="panel-section">
            <label className="panel-label">Use Item</label>
            <div className="use-item-form">
              <label htmlFor="item-select" className="form-label">Item to use</label>
              <select
                id="item-select"
                className="panel-input"
                value={selectedUseItem}
                onChange={(e) => handleUseItemSelect(e.target.value)}
              >
                <option value="">Select an item...</option>
                {upstreamItems.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              {selectedUseItem && (
                <div className="checkbox-wrapper">
                  <input
                    type="checkbox"
                    id="remove-after-use"
                    checked={removeAfterUse}
                    onChange={(e) => handleRemoveAfterUseChange(e.target.checked)}
                  />
                  <label htmlFor="remove-after-use">Remove from inventory after use</label>
                </div>
              )}
            </div>
          </div>

          <div className="panel-section">
            <label className="panel-label">Inventory</label>
            <p className="panel-hint">The items collected up to this point</p>
            {upstreamItems.length === 0 ? (
              <div className="panel-note">No available items from previous nodes.</div>
            ) : (
              <div className="items-list">
                {upstreamItems.map((item, index) => (
                  <div key={index} className="item-chip item-chip-readonly">
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="panel-section">
          <label className="panel-label">Inventory</label>
          <p className="panel-hint">The items collected up to this point</p>
          {availableItems.length === 0 ? (
            <div className="panel-note">No items collected yet.</div>
          ) : (
            <div className="items-list">
              {availableItems.map((item, index) => (
                <div key={index} className="item-chip item-chip-readonly">
                  <span>{item}</span>
                </div>
              ))}
            </div>
          )}
        </div>
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
