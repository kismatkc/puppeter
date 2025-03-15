import express from "express";
import axios from "axios";
import { Redis } from "../reddis.js";
const router = express.Router();
// const stops = ["4086", "409", "5243"];
function getAllBusDetails(bus) {
    const data = bus.data.predictions;
    const filteredRoute = data?.length > 0
        ? data.find((bus) => {
            if (bus?.direction)
                return bus;
        })
        : data;
    let upcomingBusDetails = {
        routeTitle: "",
        prediction: { time: null, branch: null },
    };
    if (Array.isArray(filteredRoute.direction)) {
        const final = filteredRoute.direction.reduce((acc, item) => {
            const step1 = item.prediction;
            return [...acc, ...step1];
        }, []);
        const filteredRouteTimings = final.map((bus) => {
            return { time: bus?.seconds, branch: bus?.branch };
        });
        upcomingBusDetails = {
            routeTitle: filteredRoute.routeTitle,
            prediction: filteredRouteTimings,
        };
    }
    else {
        const filteredRouteTimings = filteredRoute.direction.prediction?.map((bus) => {
            return { time: bus?.seconds, branch: bus?.branch };
        });
        upcomingBusDetails = {
            routeTitle: filteredRoute.routeTitle,
            prediction: filteredRouteTimings,
        };
    }
    return upcomingBusDetails;
}
async function fetchBusStops(req, res) {
    try {
        const response = await Redis.get("stops");
        const stops = JSON.parse(response);
        const responses = await Promise.allSettled(stops.map((stop) => axios.get(`http://webservices.nextbus.com/service/publicJSONFeed?command=predictions&a=ttc&stopId=${stop}`)));
        const filter = responses.filter((res) => res.status === "fulfilled");
        const upcomingBusDetails = filter.map((res) => {
            if (res.status === "fulfilled") {
                return getAllBusDetails(res.value);
            }
        });
        res.json({
            data: upcomingBusDetails || [],
        });
    }
    catch (error) {
        console.log(error);
        res.status(200).json({ error });
    }
}
router.get("/bus-times", fetchBusStops);
export default router;
