const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mysql = require('mysql');
const multer = require('multer');
const crypto = require('crypto');

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

dotenv.config();

// a client can be shared by different commands.
const client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const app = express();
app.use(cors());
app.use(express.json());

const randomString = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    timeout: 60000
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to database');
});

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })


// Root route
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Server is running' });
});

//
// app.post('/profile', upload.single('profile_pic'), async function (req, res, next) {

//     let imageName = randomString()
//     const params = {
//         Bucket: process.env.AWS_BUCKET_NAME,
//         Key: `Employee_Photos/` + imageName,
//         Body: req.file.buffer,
//         ContentType: req.file.mimetype,
//     }

//     const command = new PutObjectCommand(params)
//     await client.send(command)

//     res.send({ "message": "success" })

// })


// Create an employee
app.post('/employees', upload.single('profile_pic'), async (req, res) => {
    const { name, age, designation, profile_pic, id_proof } = req.body;
    let imageName = randomString()
    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `Employee_Photos/` + imageName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
    }
    const command = new PutObjectCommand(params)
    await client.send(command)

    const query = `INSERT INTO employees (name, age, designation, profile_pic, id_proof) VALUES ('${name}', '${age}', '${designation}', '${imageName}', '${id_proof}')`;
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error creating employee:', err);
            res.status(500).json({ error: 'Failed to create employee' });
            return;
        }
        res.status(201).json({ message: 'Employee created successfully' });
    });
});

// Read all employees
app.get('/employees', (req, res) => {
    // const command = new GetObjectCommand(getObjectParams);
    // const url = await getSignedUrl(client, command, { expiresIn: 3600 });
    // const command = new GetObjectCommand(getObjectParams);
    // const url = await getSignedUrl(client, command, { expiresIn: 3600 });


    const query = 'SELECT * FROM employees';
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error reading employees:', err);
            res.status(500).json({ error: 'Failed to read employees' });
            return;
        }
        res.status(200).json(result);
    });
});

// Get a single employee
app.get('/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const query = `SELECT * FROM employees WHERE id = ${id}`;

        const result = await new Promise((resolve, reject) => {
            db.query(query, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });

        if (result.length === 0) {
            res.status(404).json({ error: 'Employee not found' });
            return;
        }

        let profile_pic = `Employee_Photos/` + result[0].profile_pic
        const getObjectParams = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: profile_pic,
        }
        const command = new GetObjectCommand(getObjectParams);
        const url = await getSignedUrl(client, command, { expiresIn: 3600 });
        result[0].profile_pic = url

        res.status(200).json(result[0]);
    } catch (err) {
        console.error('Error getting employee:', err);
        res.status(500).json({ error: 'Failed to get employee' });
    }
});


// Update an employee
app.put('/employees/:id', (req, res) => {
    const { id } = req.params;
    const { name, age, designation, profile_pic, id_proof } = req.body;



    const query = `UPDATE employees SET name='${name}', age=${age}, designation='${designation}', profile_pic='${profile_pic}', id_proof='${id_proof}' WHERE id = ${id}`;
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error updating employee:', err);
            res.status(500).json({ error: 'Failed to update employee' });
            return;
        }
        res.status(200).json({ message: 'Employee updated successfully' });
    });
});

// Delete an employee
app.delete('/employees/:id', async (req, res) => {
    const { id } = req.params;

    const Imagequery = `SELECT profile_pic FROM employees WHERE id = ${id}`;

    const result = await new Promise((resolve, reject) => {
        db.query(Imagequery, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });

    if (result.length === 0) {
        res.status(404).json({ error: 'Employee not found' });
        return;
    }
    
    let profile_pic = `Employee_Photos/` + result[0].profile_pic
    const getObjectParams = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: profile_pic,
    }
    const command = new DeleteObjectCommand(getObjectParams);
    await client.send(command)

    const Deletequery = `DELETE FROM employees WHERE id = ${id}`;
    const Deleteresult = await new Promise((resolve, reject) => {
        db.query(Deletequery, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
    DeleteObjectCommand.Result = "Employee deleted successfully"
    res.status(200).json(Deleteresult);

});

// Wildcard route
app.all('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});


const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
