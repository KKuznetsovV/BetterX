import OpenAI from 'openai'
import config from 'config'

const openai = new OpenAI({
    apiKey: config.get<string>('openai.apiKey')
})

export default openai
