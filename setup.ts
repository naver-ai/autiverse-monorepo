import fs from 'fs-extra'
import dotenv from 'dotenv'
import path from 'path'
import { input, password, select, confirm } from '@inquirer/prompts';
import { nanoid } from 'nanoid';
import bcrypt from 'bcrypt';

const envPath = path.resolve(process.cwd(), ".env")
console.log(envPath)

if(fs.existsSync(envPath) == false){
    fs.createFileSync(envPath)
}

function makeExistingValidator(message: string) {
    return (input: string | null) => {
        if(input == null || input.trim().length == 0){
            return message
        }else{
            return true
        }
    }
}

const CLIENT_BLACKLISTS = ["OPENAI_API_KEY", "AUTH_SECRET", "ADMIN_ID", "ADMIN_HASHED_PW", "CLOVA_CLIENT_ID", "CLOVA_CLIENT_SECRET",
    "PRODUCTION_CERTIFICATE_PATH", "PRODUCTION_CERTIFICATE_KEY_PATH",
    "DATABASE_TYPE", 
    "POSTGRES_DB_NAME", "POSTGRES_USER", "POSTGRES_PASSWORD"
]

async function hashPassword(password: string): Promise<string>{
    let hp = await bcrypt.hash(password.trim(), 10)
    console.log(hp)
    return hp
}

async function setup(){
    const env = dotenv.config({path: envPath})?.parsed || {}

    const answers: {[key: string]: string} = {
        "BACKEND_PORT": await input({
            default: env["BACKEND_PORT"] || '3000',
            message: 'Insert Backend port number:',
            required: true,
            validate: (input) =>  {
                const pass = makeExistingValidator("Please enter a valid port number.")(input)
                if(pass !== true){
                    return pass
                }

                try{
                    Number.parseInt(input)
                    return true
                }catch(ex){
                    return "The port number must be an integer."
                }
            }
        }),
        "BACKEND_HOSTNAME": await input({
            default: env["BACKEND_HOSTNAME"] || '0.0.0.0',
            message: 'Insert Backend hostname WITHOUT protocol and port (e.g., 0.0.0.0, naver.com):',
            required: true,
            validate: makeExistingValidator("Please enter a valid hostname.")
        }),
        "BACKEND_HOSTNAME_DEV": await input({
            default: env["BACKEND_HOSTNAME_DEV"] || '0.0.0.0',
            message: 'Insert Backend hostname in development mode WITHOUT protocol and port (e.g., 0.0.0.0, naver.com):',
            required: false,
            validate: makeExistingValidator("Please enter a valid hostname.")
        }),
        "AUTH_SECRET": await input({
            default: env["AUTH_SECRET"] || 'NaverAILabHCIELMI',
            message: 'Insert any random string to be used as an auth secret:',
            required: true,
            validate: makeExistingValidator("Please enter any text.")
        }),
        "ADMIN_HASHED_PW": env["ADMIN_HASHED_PW"] || await hashPassword(await password({
            message: 'Enter password for admin:',
            validate: makeExistingValidator("Please enter a valid password.")
        })),

        "ADMIN_ID": env["ADMIN_ID"] || nanoid(),

        "OPENAI_API_KEY": await input({
            default: env["OPENAI_API_KEY"],
            message: 'Insert OpenAI API Key:',
            required: true,
            validate: makeExistingValidator("Please enter a valid API key.")
        }),

        "CLOVA_CLIENT_ID": await input({
            default: env["CLOVA_CLIENT_ID"],
            message: 'Insert Clova Client ID:',
            required: true,
            validate: makeExistingValidator("Please enter a valid Client ID.")
        }),

        "CLOVA_CLIENT_SECRET": await input({
            default: env["CLOVA_CLIENT_SECRET"],
            message: 'Insert Clova Client Secret:',
            required: true,
            validate: makeExistingValidator("Please enter a valid Client Secret.")
        }),

        "DATABASE_TYPE": await select({
            message: 'Select database type:',
            choices: [
                {name: 'SQLite', value: 'sqlite'},
                {name: 'PostgreSQL', value: 'postgres'}
            ],
            default: env["DATABASE_TYPE"] || 'sqlite'
        })
    }

    if(answers["DATABASE_TYPE"] == "postgres"){
        answers["POSTGRES_DB_NAME"] = await input({
            default: env["POSTGRES_DB_NAME"] || 'autiversedb',
            message: 'Insert Postgres DB name:',
            required: true,
            validate: makeExistingValidator("Please enter a valid DB name.")
        })

        answers["POSTGRES_USER"] = await input({
            default: env["POSTGRES_USER"] || 'autiverse',
            message: 'Insert Postgres user:',
            required: true,
            validate: makeExistingValidator("Please enter a valid user.")
        })

        answers["POSTGRES_PASSWORD"] = await input({
            default: env["POSTGRES_PASSWORD"] || 'secret',
            message: 'Insert Postgres password (Use an easy string as it is not sanitized):',
            required: true,
            validate: makeExistingValidator("Please enter a valid password.")
        })
    }

    answers["USE_HTTPS"] = (await confirm({
        default: env["USE_HTTPS"] == "1" || false,
        message: 'Use HTTPS instead of HTTP?'
    })) == true ? "1" : "0"

     // second pass
     if(answers["USE_HTTPS"] == "1"){

        answers["USE_HTTPS_IN_DEV"] = (await confirm({
            default: env["USE_HTTPS_IN_DEV"] == "1" || false,
            message: 'Use HTTPS in development mode (for local development)?'
        })) == true ? "1" : "0"

        answers["PRODUCTION_CERTIFICATE_PATH"] = await input({
            default: env["PRODUCTION_CERTIFICATE_PATH"],
            message: 'Insert path to production certificate:',
            required: false
        })

        answers["PRODUCTION_CERTIFICATE_KEY_PATH"] = await input({
            default: env["PRODUCTION_CERTIFICATE_KEY_PATH"],
            message: 'Insert path to production certificate key:',
            required: false
        })
    }

    for(const key of Object.keys(answers)){
        if((key.startsWith("VITE_") == false && key.startsWith("EXPO_PUBLIC_") == false) && CLIENT_BLACKLISTS.indexOf(key) === -1){
            answers[`VITE_${key}`] = answers[key]
            answers[`EXPO_PUBLIC_${key}`] = answers[key]
        }
    }

    const envFileContent = Object.entries(answers)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

    fs.writeFileSync(envPath, envFileContent, {encoding:'utf-8'})

    fs.copyFileSync(envPath, path.join(process.cwd(), "/apps/backend", ".env"))
    fs.copyFileSync(envPath, path.join(process.cwd(), "/apps/mobile", ".env"))

    console.log("Setup complete. If you want to reset, remove the '.env' file from the root directory.")
}

setup().then()