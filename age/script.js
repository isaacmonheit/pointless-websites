document.getElementById('nameForm').addEventListener('submit', function(event) {
    event.preventDefault();
    const name = document.getElementById('name').value;
    guessAge(name);
});

function guessAge(name) {
    fetch(`https://api.agify.io?name=${name}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('result').textContent = `The predicted age for the name ${name} is ${data.age} years.`;
        })
        .catch(error => {
            console.error('Error fetching the age:', error);
            document.getElementById('result').textContent = 'An error occurred while guessing the age.';
        });
}
