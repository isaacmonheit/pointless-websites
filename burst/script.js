document.addEventListener("DOMContentLoaded", function() {
    var canvas = document.getElementById('artCanvas');
    var ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    var burstSizeSlider = document.getElementById('burstSize');
    var maxRadiusSlider = document.getElementById('maxRadius');
    var speedSlider = document.getElementById('speed');

    canvas.addEventListener('click', function(event) {
        var x = event.clientX - canvas.offsetLeft;
        var y = event.clientY - canvas.offsetTop;
        create3DBurst(x, y, burstSizeSlider.value, maxRadiusSlider.value, speedSlider.value);
    });

    function create3DBurst(x, y, burstSize, maxRadius, speed) {
        for (var i = 0; i < burstSize; i++) {
            setTimeout(function() {
                var dx = (Math.random() - 0.5) * 20;
                var dy = (Math.random() - 0.5) * 20;
                draw3DMovingCircle(x, y, dx, dy, maxRadius, speed);
            }, i * (100 - speed));
        }
    }

    function draw3DMovingCircle(x, y, dx, dy, maxRadius, speed) {
        var initialRadius = 5;
        var lifespan = 1000;

        var start = Date.now();
        var interval = setInterval(function() {
            var currentTime = Date.now();
            var deltaTime = currentTime - start;
            var progress = deltaTime / lifespan;

            if (progress > 1) {
                clearInterval(interval);
                return;
            }

            var radius = initialRadius + (maxRadius - initialRadius) * progress;
            var opacity = 1 - progress;
            var color = `rgba(${randomRGB()}, ${opacity})`;

            ctx.beginPath();
            ctx.arc(x + dx * deltaTime / (100 - speed), y + dy * deltaTime / (100 - speed), radius, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
        }, 10);
    }

    var colorPaletteSlider = document.getElementById('colorPalette');


    function randomRGB() {
        // const colorPalettes = [
        //     [255, 182, 193], // Light Pink
        //     [135, 206, 235], // Sky Blue
        //     [255, 222, 173], // Navajo White
        //     [152, 251, 152], // Pale Green
        //     [221, 160, 221], // Plum
        //     [255, 218, 185], // Peach Puff
        //     [173, 216, 230]  // Light Blue
        // ];


        const palettes = [
                // Palette 1: Soft Pastels
                [[255, 182, 193], [135, 206, 235], [255, 222, 173], [152, 251, 152]],
                // Palette 2: Earth Tones
                [[244, 164, 96], [210, 180, 140], [188, 143, 143], [128, 128, 0]],
                // Palette 3: Bright and Bold
                [[255, 69, 0], [0, 191, 255], [123, 104, 238], [0, 255, 127]],
                // Palette 4: Monochrome
                [[105, 105, 105], [169, 169, 169], [192, 192, 192], [220, 220, 220]],
                // Palette 5: Neon Glow
                [[255, 0, 255], [0, 255, 255], [255, 255, 0], [0, 255, 0]],
                // Palette 6: Jewel Tones
                [[75, 0, 130], [0, 128, 128], [255, 215, 0], [255, 20, 147]]
        ];
    
        const selectedPalette = palettes[colorPaletteSlider.value];
        const randomColor = selectedPalette[Math.floor(Math.random() * selectedPalette.length)];
        return `${randomColor[0]}, ${randomColor[1]}, ${randomColor[2]}`;
        
        // const randomColor = colorPalettes[Math.floor(Math.random() * colorPalettes.length)];
        // return `${randomColor[0]}, ${randomColor[1]}, ${randomColor[2]}`;
    }
});
