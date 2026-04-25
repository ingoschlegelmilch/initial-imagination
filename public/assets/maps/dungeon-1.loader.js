// Phaser 3 loader snippet for the 'dungeon-1' map.
// Drop the preload() and create() bodies into your scene.
// Paths below are relative to the tmj file's location.
// Adjust them to be relative to your Phaser web root before shipping.

function preload() {
    this.load.image('dungeon-1_tiles', '../tilesets/dungeon-1.png');
    this.load.tilemapTiledJSON('dungeon-1', 'dungeon-1.tmj');
}

function create() {
    const map = this.make.tilemap({ key: 'dungeon-1' });
    const tileset = map.addTilesetImage('dungeon-1', 'dungeon-1_tiles');

    const groundLayer = map.createLayer('ground', tileset, 0, 0);
}
