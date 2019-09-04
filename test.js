const axios = require('axios');
const BASE_URL = process.env.BASE_URL;
// const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InByYXRlZWttZXdhcmExMzMxQGdtYWlsLmNvbSIsInJvbGUiOiIiLCJvcmdhbml6YXRpb24iOiJERUZBVUxUIn0.yxPwMgoeVZlsZkibzpbqtPquYXE0nlTJhZ3rGmUg2Q8';
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InByYXRlZWttZXdhcmExMzMxQGdtYWlsLmNvbSIsInJvbGUiOiIiLCJvcmdhbml6YXRpb24iOiJERUZBVUxUIn0.yxPwMgoeVZlsZkibzpbqtPquYXE0nlTJhZ3rGmUg2Q8"
const instance = axios.create({
    baseURL: BASE_URL,
    timeout: 1000,
    headers: {'Authorization': TOKEN}
});
test = async () => {
    let response;
    try {
        response = await instance.post('simple-projection/project-all', {
            event: "Developer 1O1",
            day: 0,
            query: {
                key: "",
                value: "",
                specific: "DSCVIT"
            }
        });
        console.log(response.data.rs);
    } catch (e) {
        console.log(e);
    }
};

test();