import { z } from 'zod';
import axios from 'axios';

const apiurl = 'https://pokeapi.co/api/v2';

export const pokeMonsterData = {
  name: 'pokeMonsterData',
  description: 'GET pokemon data',
  params: {
    nameOrId: z.string().describe('GET id or name'),
  },
  handler: async function ({ nameOrId }) {
    const url = `${apiurl}/pokemon/${nameOrId}`;
    const response = await axios.get(url);
    const data = response.data;
    let textResponse = `Found ${data.name}`;
    data.types.forEach((type, hdx) => {
      textResponse += `\n- ${type.type.name}`;
    });
    textResponse += `\nSprite: ${data.sprites.front_default}`;
    return {
      content: [
        { type: 'text', text: textResponse }
      ]
    }
  }
}
