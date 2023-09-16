#include <bits/stdc++.h>

#define tiii tuple<int, int, int>

using namespace std;

struct point {
    string name;
    int year;
    bool essential;
    int weightToPrev;
    int skipTo = -1;
};

int main() {
    vector<point> origTour;
    queue<int> essPath;
    
    {
        int N;
        cin >> N;

        unordered_map<string, int> nameMap;
        origTour.resize(N);

        int oldPos = 0;
        for (int i = 0; i < N; i++) {
            string name, yearStr, essStr, posStr;
            getline(cin, name, ',');
            getline(cin, yearStr, ',');
            getline(cin, essStr, ',');
            getline(cin, posStr);
            bool ess = essStr == "X";
            int pos = stoi(posStr);

            origTour[i] = {name, stoi(yearStr), ess, pos - oldPos};
            if (ess) essPath.push(i);

            if (nameMap.count(name) > 0) {
                origTour[nameMap[name]].skipTo = i;
            }
            nameMap[name] = i;

            oldPos = pos;
        }
        origTour[N - 1].skipTo = 0;
    }

    essPath.push(essPath.front());
    int entry = essPath.front();

    vector<int> preds(origTour.size(), -1);
    {
        priority_queue<tiii, vector<tiii>, greater<tiii>> pq;
        pq.push({0, -1, essPath.front()});
        essPath.pop();
        while(!pq.empty()) {
            auto [d, p, v] = pq.top();
            pq.pop();

            if (preds[v] >= 0) continue;
            preds[v] = p;
            
            if (v == essPath.front()) {
                essPath.pop();
                pq = priority_queue<tiii, vector<tiii>, greater<tiii>>();
            }
            
            if (v + 1 < origTour.size())
                pq.push({d + origTour[v + 1].weightToPrev, v, v + 1});
            if (origTour[v].skipTo >= 0 && origTour[v].skipTo <= essPath.front())
                pq.push({d, v, origTour[v].skipTo});
        }
    }

    while (origTour[entry].year < origTour[preds[entry]].year)
        entry = preds[entry];

    vector<int> newTour;
    {
        int v = entry;
        do {
            v = preds[v];
            newTour.push_back(v);
        } while (v != entry);
        reverse(newTour.begin(), newTour.end());
    }

    for (int v : newTour) {
        point p = origTour[v];
        cout << p.name << "," << p.year << "," << (p.essential ? "X," : " ,") << 1 << endl;
    }

    return 0;
}