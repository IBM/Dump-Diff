const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const util = require('util');
const md5 = require('md5')

const app = express();

var state = new Map();

app.use(cors());
app.use(express.json());

function dirList(dirpath)  {

  var filelist = new Array();
  const files = [dirpath];
  do {
    const filepath = files.pop();
    const stat = fs.lstatSync(filepath);
    if (stat.isDirectory()) {
      fs.readdirSync(filepath).forEach((f) => files.push(path.join(filepath, f)));
    } else if (stat.isFile()) {
      filelist.push(path.relative(dirpath, filepath));
    }
  } while (files.length !== 0);

  return filelist;
};

app.get('/getProjects', (req, res) => {
  const folderPath = config.workDirPath;
  const projectDirs = fs.readdirSync(folderPath);
  console.log("projects: ", projectDirs);
  res.json({projectDirs});
});


app.post('/checkSums', (req, res) => {
    const id = req.query.id;
    console.log("in checksums: "+id);
    state.set(id, {'project': req.body.project, 'file1':req.body.file1, 'file2':req.body.file2});
    res.json(state.get(id));
});
app.get('/poll', (req, res) => {
    var id = req.query.id;

    console.log(id);

    var path1 = path.join(config.workDirPath, state.get(id).project, 'unzipped', path.basename(state.get(id).file1, '.jar'));
    var path2 = path.join(config.workDirPath, state.get(id).project, 'unzipped', path.basename(state.get(id).file2, '.jar'));
    var files1 = new Set(dirList(path1));
    var files2 = new Set(dirList(path2));
    var files =  new Set([...files1].filter(i => files2.has(i)));

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

    files.forEach((file) => {
            var md1 =  md5(fs.readFileSync(path.join(path1, file)));
            var md2 = md5(fs.readFileSync(path.join(path2, file)));
            var msg = [file, md1 == md2 ? 'same': 'diff'];
            console.log(msg);
            res.write(`data: ${JSON.stringify(msg)}\n\n`);
    });
    res.on("close", () => {
            res.end();
    });
});
app.post('/getJarFiles', (req, res) => {
  // all files
  const jarFiles = [];
  const {project} = req.body;
        console.log("project: " + project);
  // path to where projects are held
  const projectDir = path.join(config.workDirPath, project);
  console.log("projectDir: " + projectDir);

  // read the diff targets (patched or unpatched)

	const files = fs.readdirSync(projectDir);
    for (const f of files) {
        if (path.extname(f).toLowerCase() == '.jar') {
            jarFiles.push(f);
        }
    }
  console.log(jarFiles);
  res.json({ jarFiles });
});

app.post('/unzip', (req, res) => {
  const jarFileName = req.body.jarFile
  const project = req.body.project
  const folderPath = path.join(config.workDirPath, project);

  if (!jarFileName) {
    return res.status(400).send('JAR file name is required.');
  }

  const jarPath = path.join(folderPath, jarFileName);
  const unzipDir = path.join(folderPath, 'unzipped', path.basename(jarFileName, '.jar'));

  if (!fs.existsSync(unzipDir)) {
    fs.mkdirSync(unzipDir, { recursive: true });
  }

  console.log(`Executing jar xf command in ${unzipDir}`);
        console.log(`jarpath is ${jarPath}`);
  const jarProcess = spawn('jar', ['xf', jarPath], { cwd: unzipDir });

  jarProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Error unzipping file: Process exited with code ${code}`);
      return res.status(500).json({ error: 'Error unzipping file', details: `Process exited with code ${code}` });
    }

    console.log(`Unzipped ${jarPath} to ${unzipDir}`);

    const getDirectoryStructure = (dir, basePath = '') => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      return entries.map(entry => {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.join(basePath, entry.name);
        if (entry.isDirectory()) {
          return {
            name: entry.name,
            type: 'directory',
            path: relativePath,
            children: getDirectoryStructure(fullPath, relativePath),
          };
        } else {
          return {
            name: entry.name,
            type: 'file',
            path: relativePath,
          };
        }
      });
    };

    const directoryStructure = getDirectoryStructure(unzipDir);
    res.json({ structure: directoryStructure });
  });

  jarProcess.on('error', (err) => {
    console.error(`Error spawning jar process: ${err}`);
    res.status(500).json({ error: 'Error spawning jar process', details: err.message });
  });
});

const moveJavaFilesToRoot = (dir, rootDir) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      moveJavaFilesToRoot(filePath, rootDir);
    } else if (file.endsWith('.java')) {
      const destPath = path.join(rootDir, file);
      if (filePath !== destPath) {
        fs.renameSync(filePath, destPath);
        console.log(`Moved ${filePath} to ${destPath}`);
      }
    }
  }
};


app.post('/decompile', async (req, res) => {
  const  fileName  = req.body.file;
  const jarName = req.body.jar;
  const project = req.body.project;
  const folderPath = path.join(config.workDirPath, project);

  const inputPath = path.join(folderPath, 'unzipped', path.basename(jarName, '.jar'),  fileName);

  console.log('Decompile request received for file:', fileName);
  console.log('Folder path:', folderPath);

  if (!fileName) {
    console.error('No file name provided');
    return res.status(400).send('File name is required.');
  }

  const cfrJarPath = path.resolve(__dirname, 'cfr-0.152.jar');

  console.log('CFR jar path:', cfrJarPath);

  if (!fs.existsSync(cfrJarPath)) {
    console.error(`CFR jar file does not exist: ${cfrJarPath}`);
    return res.status(500).json({ error: 'CFR jar not found', details: `File ${cfrJarPath} does not exist` });
  }

  try {
    console.log('Searching for .class file in workdir...');
   /* 
    // Recursive function to search for the file
    const findFile = (dir) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          const found = findFile(filePath);
          if (found) return found;
        } else if (file === fileName) {
          return filePath;
        }
      }
      return null;
    };

    const inputPath = findFile(folderPath);
    console.log('File search completed.');

    if (!inputPath) {
      console.error(`Class file not found: ${fileName}`);
      return res.status(404).json({ error: 'Class file not found', details: `File ${fileName} does not exist in the workdir` });
    }

    console.log('Input file found:', inputPath);
*/
    const decompiledDir = path.join(folderPath, 'decompiled', path.basename(jarName, '.jar'));
    const className = path.basename(fileName, '.class');
    const outputPath = path.join(decompiledDir, path.dirname(fileName), `${className}.java`);

    console.log('Input path:', inputPath);
    console.log('Output path:', outputPath);

    if (!fs.existsSync(decompiledDir)) {
      console.log('Creating decompiled directory:', decompiledDir);
      fs.mkdirSync(decompiledDir, { recursive: true });
    }

    const args = ['-jar', cfrJarPath, inputPath, '--outputpath', decompiledDir];

    console.log('Executing command:', 'java', args.join(' '));

    const child = spawn('java', args);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('CFR stdout:', data.toString());
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error('CFR stderr:', data.toString());
    });

    child.on('close', (code) => {
      console.log(`CFR process exited with code ${code}`);
      if (code !== 0) {
        console.error(`Decompilation error: Process exited with code ${code}`);
        return res.status(500).json({ error: 'Error during decompilation', details: stderr });
      }
  
      // Give a small delay to ensure file system has completed writing

        setTimeout(() => {
        actualOutputPath = outputPath;
        fs.readFile(actualOutputPath, 'utf8', (err, data) => {
          if (err) {
            console.error(`Error reading decompiled file: ${err}`);
            return res.status(500).json({ error: 'Error reading decompiled file', details: err.message });
          }
  
          console.log('Successfully read decompiled file');
          console.log('Decompiled content (first 100 characters):', data.substring(0, 100));
          res.json({ assemblyCode: data });
        });
      }, 1000); // 1 second delay
    });

    child.on('error', (err) => {
      console.error(`Error spawning CFR process: ${err}`);
      res.status(500).json({ error: 'Error spawning CFR process', details: err.message });
    });

  } catch (error) {
    console.error('Error during decompilation process:', error);
    res.status(500).json({ error: 'Error during decompilation process', details: error.message });
  }
});

app.get('/readJavaFile', (req, res) => {
  const { filePath } = req.query;
  const folderPath = config.workDirPath;

  if (!filePath) {
    return res.status(400).send('No file path provided.');
  }

  const fullPath = path.join(folderPath, 'unzipped', filePath);

  fs.readFile(fullPath, 'utf8', (err, data) => {
    if (err) {
      console.error(`Error reading file: ${err}`);
      return res.status(500).json({ error: 'Error reading file', details: err.message });
    }

    res.json({ content: data });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
