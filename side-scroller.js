$(function() {
    var Q = window.Q = Quintus({audioSupported: ['mp3']})
                       .include('Input,Sprites,Scenes,Touch,UI,TMX,Anim,2D,Audio')
                       .setup({width: 1000, height: 500})
                       .controls()
                       .touch()
                       .enableSound();

    Q.input.bindKey(65, 'left');
    Q.input.bindKey(68, 'right');
    Q.input.bindKey(87, 'up');
    Q.input.bindKey(83, 'down');
    Q.input.bindKey(16, 'sprint');      //Shift
    Q.input.bindKey(17, 'regenerate');  //Control
    
    Q.SPRITE_PLAYER = 1;
    
    
//    Q.debug = true;
//    Q.debugFill = true;
    

    Q.generateCirclePoints = function(a,b,r){
        var out = [];
        for(var i=0;i<Math.PI*2;i+=Math.PI/10){
            var x = Math.round(a + r * Math.cos(i));
            var y = Math.round(b + r * Math.sin(i));
            var point = [x,y];
            out.push(point);
        }
        return out;
    }
    
    
    ////Classes//////////////////////////////////////////////////

    /*
    Class: Q.Player
    Extends: Q.Sprite
    Overrides: init, step
    */
    Q.Sprite.extend("Player",{
        init: function(p) {
            this._super(p,{
                sheet: "player1",  // Setting a sprite sheet sets sprite width and height
                sprite: "player",
                type: Q.SPRITE_PLAYER,
                walkingPoints: [ [ -16, 44], [ -23, 35 ], [-23,-48], [23,-48], [23, 35 ], [ 16, 44 ]],
                rollingPoints: Q.generateCirclePoints(0,0,33),
                walkingJumpSpeed: -600,
                rollingJumpSpeed: -300,
                attack: 5,
                health: Q.state.get('health'),
                morphing: false,    //true when morphing
                morph: false,       //true when in morph mode,
                walkingSpeed: 200,
                sprintSpeed: 350,
                rollingSpeed: 400,
                bounceBack: 30,
                reloadTime : 30,
                reload: -1
            });
            
            this.p.rollAngle = Math.atan(this.p.rollingSpeed/25) * (180 / Math.PI) / 12;
            this.p.points = this.p.walkingPoints;
            this.p.speed = this.p.walkingSpeed;
            this.p.jumpSpeed = this.p.walkingJumpSpeed;
            
            this.add('2d, platformerControls, animation, tween');

            this.on('bump.bottom',this,'stomp');
            this.on('bump.top',this,'attacked');
            this.on('bump.left',this,'attacked');
            this.on('bump.right',this,'attacked');
            this.on('morphed',this,'morphed');
            this.on('unmorphed',this,'unmorphed');
        },

        attacked: function(col){
            if(col.obj instanceof Q.Enemy){
                this.p.health -= col.obj.p.attack;
                Q.state.set('health',this.p.health);

                this.p.x += col.normalX * this.p.bounceBack;
                this.p.y -= this.p.bounceBack / 2;
            }
        },

        stomp: function(col){
            if(col.obj instanceof Q.Enemy){ 
                col.obj.trigger('attack',this.p.attack);
                this.p.vy = this.p.jumpSpeed / 2;
            }
            
        },

        walk: function(dt){ 
            if(this.p.vx > 0) {
                if(this.p.landed > 0) {
                    this.play("walk_right");
                } else {
                    this.play("jump_right");
                }
                this.p.direction = "right";
            } else if(this.p.vx < 0) {
                if(this.p.landed > 0) {
                    this.play("walk_left");
                } else {
                    this.play("jump_left");
                }
                this.p.direction = "left";
            } else {
                this.play("stand_" + this.p.direction);
            }
        },
        
        roll: function(dt){
            if(this.p.vx > 0) {
                this.p.angle += this.p.rollAngle;
            } else if(this.p.vx < 0) {
                this.p.angle -= this.p.rollAngle;
            }
        },

        step: function(dt) {
            if(Q.state.get('menu')){
                this.p.vx = 0;
                this.p.vy = 0;
                return;
            }
            
            if(!this.p.morphing){
                
                if(this.p.morph){
                   this.roll(dt); 
                }else{
                    this.walk(dt);
                }
                
                if(Q.state.get("oxygen") === 0) {
                    Q.state.dec("health",0.1);   
                }
                
                if(!Q.inputs['regenerate'] && !Q.inputs['sprint']){
                    Q.state.inc("energy",0.1);
                }
                
                Q.state.dec("oxygen",0.1);
                
                if(Q.inputs['regenerate'] && Q.state.get("energy") > 5 && this.p.landed > 0 && this.p.vx === 0 && !this.p.morph){
                    this.play("regenerating",1);
                    Q.state.dec("energy",0.4);
                    Q.state.inc("oxygen",0.5);
                    Q.state.inc("health",0.1);
                }
                
                
                if(Q.inputs['sprint'] && !this.p.morph){
                    this.p.speed = this.p.sprintSpeed;
                    Q.state.dec("oxygen",0.2);
                }else{
                    if(this.p.morph){
                        this.p.speed = this.p.rollingSpeed;
                    } else {
                        this.p.speed = this.p.walkingSpeed;
                    }
                }
                
                if(Q.inputs['fire'] && Q.state.get("energy") >= 10 && !this.p.morph && this.p.reload <= 0){
                    var attX = this.p.direction === "left" ? this.p.x - 80 : this.p.x + 80;
                    Q.state.dec('energy',10);
                    this.stage.insert(new Q.EnergyAttack({
                        x: attX,   
                        y: this.p.y,
                        direction: this.p.direction
                    }));
                    
                    this.p.reload = this.p.reloadTime;
                }else{
                    this.p.reload -= 1;
                }
                
                if((Q.inputs["down"]) && Q.state.get("energy") >= 10 && this.p.landed > 0){  //map morph to "A" on mobile for now
                    if(this.p.morph){
                        this.p.angle = 0;
                        this.play("unmorphing",1);
                        Q.audio.play("morphUp.mp3");
                    }else{
                        this.p.walkingCollisionPoints = this.c.points.slice(0);
                        this.play("morphing",1);
                        Q.audio.play("morphDown.mp3");
                    }
                    Q.state.dec('energy',10);
                    this.p.morphing = true;
                    this.p.ignoreControls = true;
                    this.p.vx = 0;
                }
            }
            
            if(this.p.y > 1500) {
                this.stage.unfollow();   
            }
            
            if(this.p.y > 2000){
                if(!Q.state.get('menu')) {
                    Q.stageScene("lossMenu");
                } else {
                    Q.stageScene("game");
                }
            }
        },
        
        morphed: function(){
            this.p.ignoreControls = false;
            this.p.morph = true;
            this.p.morphing = false;
            this.p.points = this.p.rollingPoints;
            this.p.speed = this.p.rollingSpeed;
            this.p.jumpSpeed = this.p.rollingJumpSpeed;
            this.p.cy = 62;
        },
        
        unmorphed: function(){
            this.p.ignoreControls = false;
            this.p.morph = false;
            this.p.morphing = false;
            this.p.points = this.p.walkingPoints;
            this.p.speed = this.p.walkingSpeed;
            this.p.jumpSpeed = this.p.walkingJumpSpeed;
            this.c.points = this.p.walkingCollisionPoints;  //prevent collision errors after changing points
            this.p.cy = 49;
        }
    });
    
    Q.Sprite.extend("EnergyAttack", {
        init: function(p){
            this._super(p, {
                projectileSpeed: 10,
                scale: 1.5, 
                sheet: 'playerAttack',
                sprite: 'attack',
                attack: 10
            });
            
            this.on('hit');
            this.add('animation');
            
            this.play('energy_attack_' + this.p.direction);
        },
        
        hit: function(col){
            if(col.obj instanceof Q.Enemy){
                col.obj.trigger('attack',this.p.attack);
            }
            this.destroy();
        },
        
        step: function(dt) {
            if(this.p.direction === "right")
                this.p.x += this.p.projectileSpeed;
            else   
                this.p.x -= this.p.projectileSpeed;
        }
        
    });

    Q.Sprite.extend("Enemy", {
        init: function(p) {
            this._super(p, {
                sheet: "player",
                sprite: "enemy",
                scale: 0.6,
                health: 5,
                points: [ [ -16, 44], [ -23, 35 ], [-23,-48], [23,-48], [23, 35 ], [ 16, 44 ]],
                jumpSpeed: -200,
                attack: 1,
                direction: "right"
            });

            this.add('2d, animation, tween');

            this.on('attack',this,'attacked');
        },

        move: function(dt){
            if(this.p.vx > 0) {
                if(this.p.landed > 0) {
                    this.play("walk_right");
                } else {
                    this.play("jump_right");
                }
                this.p.direction = "right";
            } else if(this.p.vx < 0) {
                if(this.p.landed > 0) {
                    this.play("walk_left");
                } else {
                    this.play("jump_left");
                }
                this.p.direction = "left";
            } else {
                this.play("stand_" + this.p.direction);
            }
        },

        attacked: function(attack){
            this.p.health -= attack;
            Q.audio.play("enemyHit.mp3");
            if(this.p.health <= 0){
                this.destroy();
            }
        },

        step: function(dt){
            this.move(dt);
        }
    });

    Q.Enemy.extend("Jumper", {
        init: function(p) {
            this._super(p);
            this.p.resetCount = 50;
            this.p.count = this.p.resetCount;
            this.p.jumpSpeed = -400;    
        },

        jump: function(){
            this.p.vy = this.p.jumpSpeed;
        },

        step: function(dt){
            this._super();
            if(this.p.count === 0){
                this.jump();
                this.p.count = this.p.resetCount;
            }

            this.p.count--;
        }
    });

    Q.Enemy.extend("Roamer", {
        init: function(p) {
            this._super(p);
        },

        step: function(dt){

        }
    });

    
    Q.Sprite.extend("ShipPart", {
        init: function(p) {
            this._super(p,{
                sheet: "shipPart",
                sensor: true
            });
            
            this.on("sensor");
        },
        
        sensor: function(obj) {
            if(obj instanceof Q.Player){
                Q.state.inc("parts",1);
                this.destroy();
            }
        }
    });
    
    Q.Sprite.extend("Ship", {
        init: function(p) {
            this._super(p,{
                sheet: "ship",
                sensor: true,
                frame: 6,
                ready: false,
                win: false
            });
            
            this.on("sensor");
            Q.state.on("change.parts",this,"newPart");
        },
        
        newPart: function(){
            if(Q.state.get("parts") >= Q.state.get("partsLimit")){
                this.p.ready = true;
                this.p.frame = 0;
            } else { 
                if(this.p.frame > 0)
                    this.p.frame--;
            }
        },
        
        sensor: function(obj){
            if(this.p.ready && obj instanceof Q.Player && !this.p.win){
                Q("Player").first().destroy();
                Q.stage().follow(this);
                this.p.win = true;
                if(!Q.state.get("menu")){
                    Q.stageScene("winMenu",2);
                } else {
                    Q.stageScene("game");
                }
            }
        },
        
        step: function(dt) {
            if(this.p.win){
                this.p.y -= 2;  
            }
        }
    });
    
    
    Q.UI.Button.extend("HUD", {
        init: function(p) {
            this._super({
                asset: 'GUI.png',
                x: Q.width - 80,
                y: Q.height - 50
            });
        }
    });
    
    Q.UI.Container.extend("Bar", {
        init: function(p){
            var props = {
                fill: 'rgb(255,255,255)',
                fillColor: 'rgb(255,255,255)', 
                w: 17, 
                h: 67, 
                initialH: 65,
                on: true, 
                countdown: -1, 
                resetCount: 10 
            };
            for(var key in p){ props[key] = p[key]; }
            this._super(props);
            this.p.initialY = this.p.y;
        },
        
        shrink: function(curr,max) {
            this.p.h = this.p.initialH * curr / max;
            this.p.y = this.p.initialY + (this.p.initialH - this.p.h);            
        },
        
        step: function(dt){
            if(this.p.h < this.p.initialH * 0.25){
                if(this.p.countdown < 0){
                    this.p.on = !this.p.on;
                   if(this.p.on){
                       this.p.fill = 'rgba(0,0,0,0)';
                   } else {
                       this.p.fill = this.p.fillColor;
                   }
                    this.p.countdown = this.p.resetCount;
                }
                this.p.countdown--;
            } else {
                this.p.fill = this.p.fillColor;
            }
        }
    });
    
    Q.Bar.extend("HealthBar", {
        init: function(p){
            this._super({
                fill: 'rgb(223,46,46)',
                fillColor: 'rgb(223,46,46)',
                x: Q.width - 108,
                y: Q.height - 49
            });
            
            Q.state.on("change.health", this, "shrink");
        },
        
        shrink: function(curr) {
            var player = Q("Player").first();
            if(curr > Q.maxHealth * 0.75) {
                player.p.sheet = "player1";
            } else if(curr > Q.maxHealth * 0.5) {
                player.p.sheet = "player2";
            } else if(curr > Q.maxHealth * 0.25) {
                player.p.sheet = "player3";
            } else {
                player.p.sheet = "player4";
            }           
            
            if(curr <= 0) {
                Q.state.set("health",0);
                if(!Q.state.get('menu')) {
                    Q.stageScene("lossMenu");
                } else {
                    Q.stageScene("game");
                }
            } else if(curr > Q.maxHealth){
                Q.state.set("health",Q.maxHealth);
            } else {
                this._super(curr,Q.maxHealth); 
            }
        },
        
        step: function(dt){
            this._super(dt);
        }
    });
    
    Q.Bar.extend("OxygenBar", {
        init: function(p){
            this._super({
                fill: 'rgb(46,46,223)',
                fillColor: 'rgb(46,46,223)',
                x: Q.width - 79,
                y: Q.height - 49
            });
            
            Q.state.on("change.oxygen", this, "shrink");
        },
        
        shrink: function(curr) {
            if(curr < 0){
                Q.state.set("oxygen", 0);
            } else if(curr > Q.maxOxygen) {
                Q.state.set("oxygen", Q.maxOxygen);
            } else {
                this._super(curr,Q.maxOxygen);
            }
        },
        
        step: function(dt){
            this._super(dt);
        }
    });
    
    Q.Bar.extend("EnergyBar", {
        init: function(p){
            this._super({
                fill: 'rgb(136, 136, 34)',
                fillColor: 'rgb(136, 136, 34)',
                x: Q.width - 50,
                y: Q.height - 49
            });
            
            Q.state.on("change.energy", this, "shrink");
        },
        
        shrink: function(curr) {
            if(curr < 0) {
                Q.state.set("energy",0);
            } else if(curr > Q.maxEnergy) {
                Q.state.set("energy",Q.maxEnergy);
            } else {
                this._super(curr,Q.maxEnergy); 
            }
        },
        
        step: function(dt){
            this._super(dt);
        }
    });
        

    ////Scenes///////////////////////////////////////////////////
    
    Q.scene('mainMenu', function(stage) {
        
        Q.state.set('menu',true);
        
        var container = stage.insert(new Q.UI.Container({
            fill: 'rgba(200,200,200,0.8)',
            w: Q.width,
            h: Q.height,
            x: Q.width / 2,
            y: Q.height / 2
        }));
        
        var title = stage.insert(new Q.UI.Text({ 
            label: "Isolation",
            family: "Tahoma",
            color: "black",
            size: "40",
            x: 0, 
            y: -20
        }),container);
       
        var description = stage.insert(new Q.UI.Text({
            label: "The ship is your only escape.\n",
            family: "Tahoma",
            color: "grey",
            size: "18",
            x: 0, 
            y: 25
        }),container);
        
        var startButton = stage.insert(new Q.UI.Button({
            label: 'start',
            font: '800 24px Tahoma',
            fontColor: 'lightgrey',
            fill: 'grey',
            stroke: 'white',
            border: 2,
            y: 100,
            x: 0,
            w: 150
        }, function() {
            Q.stageScene('game');
            Q.stageScene(null, 2);
            Q.state.set('menu',false);
        }), container);
    });
    
    Q.scene('winMenu', function(stage) {
        
        Q.state.set('menu',true);
        
        var container = stage.insert(new Q.UI.Container({
            fill: 'rgba(200,200,200,0.8)',
            w: Q.width,
            h: Q.height,
            x: Q.width / 2,
            y: Q.height / 2
        }));
        
        var title = stage.insert(new Q.UI.Text({ 
            label: "Congratulations",
            family: "Tahoma",
            color: "black",
            size: "40",
            x: 0, 
            y: -20
        }),container);

        var description = stage.insert(new Q.UI.Text({
            label: "You survived!",
            family: "Tahoma",
            color: "grey",
            size: "18",
            x: 0, 
            y: 25
        }),container);
        
        var startButton = stage.insert(new Q.UI.Button({
            label: 'play again',
            font: '800 24px Tahoma',
            fontColor: 'lightgrey',
            fill: 'grey',
            stroke: 'white',
            border: 2,
            y: 100,
            x: 0,
            w: 150
        }, function() {
            Q.stageScene('game');
            Q.stageScene(null, 2);
            Q.state.set('menu',false);
        }), container);
    });
    
     Q.scene('lossMenu', function(stage) {
        
        Q.state.set('menu',true);
         
        var container = stage.insert(new Q.UI.Container({
            fill: 'rgba(200,200,200,0.8)',
            w: Q.width,
            h: Q.height,
            x: Q.width / 2,
            y: Q.height / 2
        }));
        
        var title = stage.insert(new Q.UI.Text({ 
            label: "Oh no...",
            family: "Tahoma",
            color: "black",
            size: "40",
            x: 0, 
            y: -20
        }),container);

        var description = stage.insert(new Q.UI.Text({
            label: "You failed to build the ship in time",
            family: "Tahoma",
            color: "grey",
            size: "18",
            x: 0, 
            y: 25
        }),container);
        
        var startButton = stage.insert(new Q.UI.Button({
            label: 'play again',
            font: '800 24px Tahoma',
            fontColor: 'lightgrey',
            fill: 'grey',
            stroke: 'white',
            border: 2,
            y: 100,
            x: 0,
            w: 150
        }, function() {
            Q.stageScene('game');
            Q.stageScene(null, 2);
            Q.state.set('menu',false);
        }), container);
    });

    Q.scene('hud',function(stage){
        stage.insert(new Q.HealthBar());
        stage.insert(new Q.OxygenBar());
        stage.insert(new Q.EnergyBar());
        stage.insert(new Q.HUD());
        
    });

    Q.scene('game',function(stage) {
        Q.maxEnergy = 100;
        Q.maxHealth = 50;
        Q.maxOxygen = 500;
        Q.state.reset({health: Q.maxHealth, energy: Q.maxEnergy, oxygen: Q.maxOxygen, parts: 0, partsLimit: 6, menu: Q.state.get('menu')});
        Q.stageScene('hud',1);
        Q.stageTMX("level1.tmx",stage);
        stage.add("viewport").follow(Q("Player").first());

        var enemy = stage.insert(new Q.Jumper({x: 650, y: 200}));
        var enemy = stage.insert(new Q.Jumper({x: 1229, y: 96}));
        var enemy = stage.insert(new Q.Jumper({x: 1707, y: 166}));
        var enemy = stage.insert(new Q.Jumper({x: 2214, y: 166}));
    });

    ////Asset Loading  & Game Start//////////////////////////////

    Q.loadTMX(['level1.tmx','player1.png','player1.json','player2.png','player2.json','player3.png','player3.json','player4.png','player4.json','GUI.png','shipParts.png','shipParts.json','shipsCombined.png','ship.json','playerAttack.png','playerAttack.json','morphDown.mp3','morphUp.mp3','landing.mp3','jumping.mp3','enemyHit.mp3'], function() {
        Q.compileSheets('player1.png','player1.json');
        Q.compileSheets('player2.png','player2.json');
        Q.compileSheets('player3.png','player3.json');
        Q.compileSheets('player4.png','player4.json');
        Q.compileSheets('shipParts.png','shipParts.json');
        Q.compileSheets('shipsCombined.png','ship.json');
        Q.compileSheets('playerAttack.png','playerAttack.json');
        
        Q.animations("player", {
            walk_right: { frames: [0,1,2,3,4,5,6,7,8,9,10], rate: 1/15, flip: false, loop: true },
            walk_left: { frames:  [0,1,2,3,4,5,6,7,8,9,10], rate: 1/15, flip:"x", loop: true },
            jump_right: { frames: [13], rate: 1/10, flip: false },
            jump_left: { frames:  [13], rate: 1/10, flip: "x" },
            stand_right: { frames:[14], rate: 1/10, flip: false },
            stand_left: { frames: [14], rate: 1/10, flip:"x" },
            morphing: { frames: [18,19,20,21,22], rate: 1/5, trigger: "morphed", loop: false },
            unmorphing: {frames: [22,21,20,19,18], rate: 1/5, trigger: "unmorphed", loop: false },
            regenerating: {frames: [20], rate: 1/10, loop: false}
            
            // duck_right: { frames: [15], rate: 1/10, flip: false },
            // duck_left: { frames:  [15], rate: 1/10, flip: "x" },
            // climb: { frames:  [16, 17], rate: 1/3, flip: false }
        });
        
        Q.animations("attack", {
            energy_attack_right: {frames: [0,1,2,3], rate: 1/2, loop: false},
            energy_attack_left: {frames: [0,1,2,3], rate: 1/2, loop: false, flip:"x"}
        });

        Q.animations("enemy", {
            walk_right: { frames: [0,1,2,3,4,5,6,7,8,9,10], rate: 1/15, flip: false, loop: true },
            walk_left: { frames:  [0,1,2,3,4,5,6,7,8,9,10], rate: 1/15, flip:"x", loop: true },
            jump_right: { frames: [13], rate: 1/10, flip: false },
            jump_left: { frames:  [13], rate: 1/10, flip: "x" },
            stand_right: { frames:[14], rate: 1/10, flip: false },
            stand_left: { frames: [14], rate: 1/10, flip:"x" },
            // duck_right: { frames: [15], rate: 1/10, flip: false },
            // duck_left: { frames:  [15], rate: 1/10, flip: "x" },
            // climb: { frames:  [16, 17], rate: 1/3, flip: false }
        });
        
        Q.stageScene('game');
        Q.stageScene('mainMenu',2);
        
    });
});