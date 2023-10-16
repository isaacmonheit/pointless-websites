const boxes = document.querySelectorAll(".box");

setInterval(() => {
    boxes.forEach((box, index) => {
        // Calculate offset using sine wave
        const offset = 50 * Math.sin(Date.now() * 0.005 + index * 0.5);
        box.style.bottom = `calc(50% + ${offset}px)`;
    });
}, 50);
