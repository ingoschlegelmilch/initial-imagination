// Phaser 3 loader snippet for the 'town-millhaven' map.
// Drop the preload() and create() bodies into your scene.
// Paths below are relative to the tmj file's location.
// Adjust them to be relative to your Phaser web root before shipping.

function preload() {
    this.load.image('town-millhaven_tiles', '../tilesets/town-millhaven.png');
    this.load.tilemapTiledJSON('town-millhaven', 'town-millhaven.tmj');
}

function create() {
    const map = this.make.tilemap({ key: 'town-millhaven' });
    const tileset = map.addTilesetImage('town-millhaven', 'town-millhaven_tiles');

    const groundLayer = map.createLayer('ground', tileset, 0, 0);
}
