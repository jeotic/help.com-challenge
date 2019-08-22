# Help.com Challenge
This project connects to a test server, allowing the User to send JSON requests. The User can send any valid line-delimited JSON, or run an optional command. 

### Installation
After pulling down the project, run:

    npm install

### Usage
After installing all necessary libraries, run: 

    npm run start
Or

    node challenge.js
    
When your "Username" is requested, you may enter in anything and then press Enter.
When your "Password" is requested, you may enter in anything and then press Enter. 

You'll be prompted with an ">". This indicates that you may run any of the below commands. 
After you enter in a command, you'll see a prettified message, or possibly an error, from the Server. Sometimes this is instant, sometimes it takes a few seconds. When waiting on a message, you'll be unable to enter in anything.

### Possible Commands

 - /count
	 - This will send a count request and return the amount of total requests sent to the server
- /time
	- This will send a request that will return the current date/time and a random number
	- If the random number is greater than zero, a message will appear
- /time&count
	- This will send the combination of /count & /time commands
- /count&time
	- This will send the combination of /count & /time commands
- /send [your json]
	- This will send any json you enter
	- This will not show any returned message
	- This will error out if invalid JSON

### Tests
Simply run:

    npm run test
Only a few tests have been added. 