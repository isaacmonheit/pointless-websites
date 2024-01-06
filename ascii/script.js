document.getElementById('generateButton').addEventListener('click', function() {
    var file = document.getElementById('imageInput').files[0];
    var reader = new FileReader();

    reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
            var asciiArt = convertImageToAscii(this);
            document.getElementById('asciiArt').textContent = asciiArt;
        };
        img.src = e.target.result;
    };

    if (file) {
        reader.readAsDataURL(file);
    }
});

function convertImageToAscii(img) {
    var canvas = document.createElement('canvas');
    var context = canvas.getContext('2d');
    var asciiArt = '';
    var density = 'Ñ@#W$9876543210?!abc;:+=-,._ ';

    // Resize image to fit the canvas
    var width = img.width;
    var height = img.height;
    var scale = width / 100;
    canvas.width = 100;
    canvas.height = height / scale;

    context.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (var y = 0; y < canvas.height; y++) {
        for (var x = 0; x < canvas.width; x++) {
            var pixel = context.getImageData(x, y, 1, 1).data;
            var brightness = (0.34 * pixel[0] + 0.5 * pixel[1] + 0.16 * pixel[2]) / 255;
            var character = density[Math.floor(brightness * (density.length - 1))];
            asciiArt += character;
        }
        asciiArt += '\n';
    }

    return asciiArt;
}
