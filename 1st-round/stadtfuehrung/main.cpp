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
    list<int> essPath;
    
    {
        int N;
        cin >> N;

        unordered_map<string, int> nameMap;
        unordered_map<string, int> nameMapBeforeEntry;
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

            if (nameMap.count(name) > 0 && nameMap[name] >= essPath.back()) {
                origTour[nameMap[name]].skipTo = i;
            }
            nameMap[name] = i;
            if (essPath.empty())
                nameMapBeforeEntry[name] = i;

            if (ess) essPath.push_back(i);

            oldPos = pos;
        }

        for (int i = essPath.back(); i < N; i++)
            if (nameMapBeforeEntry.count(origTour[i].name) > 0)
                origTour[i].skipTo = nameMapBeforeEntry[origTour[i].name];
    }

    int entry = essPath.front();

    vector<int> preds(origTour.size(), -1);
    {
        essPath.push_back(entry);

        priority_queue<tiii, vector<tiii>, greater<tiii>> pq;
        pq.push({0, -1, entry});

        while(!pq.empty()) {
            auto [d, p, v] = pq.top();
            pq.pop();

            if (preds[v] >= 0) continue;
            preds[v] = p;
            
            if (v == essPath.front()) {
                essPath.pop_front();
                if (essPath.empty()) break;
                pq = priority_queue<tiii, vector<tiii>, greater<tiii>>();
            }
            
            if (v + 1 < origTour.size())
                pq.push({d + origTour[v + 1].weightToPrev, v, v + 1});
            if (origTour[v].skipTo >= 0)
                pq.push({d, v, origTour[v].skipTo});
        }
    }

    while (preds[entry] < entry)
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

    {
        int pos = 0;
        cout << newTour.size() << "\n";
        for (int i = 0; i < newTour.size(); i++) {
            point p = origTour[newTour[i]];
            if (i > 0 && newTour[i - 1] + 1 == newTour[i])
                pos += p.weightToPrev;
            cout << p.name << "," << p.year << "," << (p.essential ? "X," : " ,") << pos << "\n";
        }
    }

    return 0;
}