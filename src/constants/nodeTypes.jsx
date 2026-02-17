export const NODE_TYPES = {
  PLAYER_ACTION: 'PLAYER_ACTION',
  CHARACTER_ACTION: 'CHARACTER_ACTION',
  GET_ITEM: 'GET_ITEM',
  USE_ITEM: 'USE_ITEM',
  GOAL: 'GOAL',
  STORY_STATE: 'STORY_STATE'
};

export const NODE_CONFIG = {
  [NODE_TYPES.PLAYER_ACTION]: {
    label: 'Player Action',
    color: '#FFF5DE',
    borderColor: '#FFE6AB solid 1px',
    icon: '/icons/player-action.svg',
    defaultTitle: 'New player action'
  },
  [NODE_TYPES.CHARACTER_ACTION]: {
    label: 'Character Action',
    color: '#DEFFDE',
    borderColor: '#A6F7A6 solid 1px',
    icon: '/icons/character-action.svg',
    defaultTitle: 'New character action'
  },
  [NODE_TYPES.GET_ITEM]: {
    label: 'Get Item',
    color: '#DEFCFF',
    borderColor: '#9ADFE5 solid 1px',
    icon: '/icons/get-item.svg',
    defaultTitle: 'New item to get'
  },
  [NODE_TYPES.USE_ITEM]: {
    label: 'Use Item',
    color: '#F1EBFF',
    borderColor: '#CDB8FF solid 1px',
    icon: '/icons/use-item.svg',
    defaultTitle: 'New item use'
  },
  [NODE_TYPES.GOAL]: {
    label: 'Goal',
    color: '#FFDEFC',
    borderColor: '#FFABF8 solid 1px',
    icon: '/icons/goal.svg',
    defaultTitle: 'New goal'
  },
  [NODE_TYPES.STORY_STATE]: {
    label: 'Story State',
    color: '#FFECEC',
    borderColor: '#FFC7C7 solid 1px',
    icon: '/icons/story-state.svg',
    defaultTitle: 'New story state'
  }
};
