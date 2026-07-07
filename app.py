from flask import Flask, render_template, request, jsonify
import random

app = Flask(__name__)

# Crop database with recommended ranges
CROP_DATA = {
    "Rice": {"N": (80, 120), "P": (40, 60), "K": (40, 60), "temp": (20, 35), "humidity": (80, 100), "ph": (5.5, 7.0), "rainfall": (150, 300)},
    "Wheat": {"N": (100, 140), "P": (40, 70), "K": (30, 50), "temp": (10, 25), "humidity": (40, 70), "ph": (6.0, 7.5), "rainfall": (50, 100)},
    "Maize": {"N": (80, 120), "P": (40, 80), "K": (30, 60), "temp": (18, 30), "humidity": (50, 80), "ph": (5.5, 7.5), "rainfall": (50, 100)},
    "Banana": {"N": (100, 200), "P": (50, 100), "K": (150, 300), "temp": (20, 35), "humidity": (75, 95), "ph": (5.5, 7.0), "rainfall": (100, 200)},
    "Mango": {"N": (30, 80), "P": (20, 60), "K": (40, 100), "temp": (24, 35), "humidity": (40, 60), "ph": (5.5, 7.5), "rainfall": (50, 100)},
    "Cotton": {"N": (80, 140), "P": (30, 70), "K": (30, 70), "temp": (20, 35), "humidity": (50, 80), "ph": (6.0, 8.0), "rainfall": (50, 100)},
    "Coconut": {"N": (10, 40), "P": (10, 30), "K": (30, 60), "temp": (25, 35), "humidity": (70, 90), "ph": (5.0, 6.5), "rainfall": (100, 250)},
    "Orange": {"N": (20, 50), "P": (10, 30), "K": (10, 40), "temp": (15, 30), "humidity": (50, 70), "ph": (5.5, 6.5), "rainfall": (60, 120)},
    "Coffee": {"N": (80, 120), "P": (15, 35), "K": (35, 65), "temp": (15, 26), "humidity": (50, 80), "ph": (6.0, 7.0), "rainfall": (140, 200)},
    "Papaya": {"N": (30, 60), "P": (50, 80), "K": (40, 70), "temp": (22, 32), "humidity": (60, 80), "ph": (6.0, 6.8), "rainfall": (80, 150)},
    "Pomegranate": {"N": (20, 40), "P": (10, 25), "K": (30, 50), "temp": (25, 35), "humidity": (30, 50), "ph": (6.0, 8.0), "rainfall": (40, 80)},
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        N = float(data['nitrogen'])
        P = float(data['phosphorous'])
        K = float(data['potassium'])
        temp = float(data['temperature'])
        humidity = float(data['humidity'])
        ph = float(data['ph'])
        rainfall = float(data['rainfall'])

        scores = {}
        for crop, ranges in CROP_DATA.items():
            score = 0
            score += max(0, 1 - abs(N - sum(ranges["N"]) / 2) / (ranges["N"][1] - ranges["N"][0] + 1))
            score += max(0, 1 - abs(P - sum(ranges["P"]) / 2) / (ranges["P"][1] - ranges["P"][0] + 1))
            score += max(0, 1 - abs(K - sum(ranges["K"]) / 2) / (ranges["K"][1] - ranges["K"][0] + 1))
            score += max(0, 1 - abs(temp - sum(ranges["temp"]) / 2) / (ranges["temp"][1] - ranges["temp"][0] + 1))
            score += max(0, 1 - abs(humidity - sum(ranges["humidity"]) / 2) / (ranges["humidity"][1] - ranges["humidity"][0] + 1))
            score += max(0, 1 - abs(ph - sum(ranges["ph"]) / 2) / (ranges["ph"][1] - ranges["ph"][0] + 1))
            score += max(0, 1 - abs(rainfall - sum(ranges["rainfall"]) / 2) / (ranges["rainfall"][1] - ranges["rainfall"][0] + 1))
            scores[crop] = round((score / 7) * 100, 1)

        best_crop = max(scores, key=scores.get)
        sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)

        return jsonify({
            "success": True,
            "recommended_crop": best_crop,
            "confidence": scores[best_crop],
            "all_scores": sorted_scores[:4],
            "input_data": {
                "N": N, "P": P, "K": K,
                "temperature": temp,
                "humidity": humidity,
                "ph": ph,
                "rainfall": rainfall
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)
