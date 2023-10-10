// When an image is uploaded
document.getElementById('imageInput').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(loadEvent) {
            const image = new Image();
            image.src = loadEvent.target.result;
            image.id = "uploadedImage";  // Setting an ID for the image

            image.onload = function() {
                // Append the uploaded image to the container
                const container = document.getElementById('imageContainer');
                container.innerHTML = '';  // Clear any previous content
                container.appendChild(image);

                // Add event listener for color extraction
                image.addEventListener('mousemove', function(e) {
                    const canvas = document.createElement('canvas');
                    canvas.width = image.width;
                    canvas.height = image.height;
                    const context = canvas.getContext('2d');
                    context.drawImage(image, 0, 0, image.width, image.height);

                    const x = e.offsetX;
                    const y = e.offsetY;
                    const pixel = context.getImageData(x, y, 1, 1).data;
                    const color = `rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${pixel[3] / 255})`;

                    // Update the display div's background color
                    document.getElementById('colorDisplay').style.backgroundColor = color;
                });
            };
        };
        reader.readAsDataURL(file);
    }
});
