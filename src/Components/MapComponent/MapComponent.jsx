import React, {Component} from 'react';
import {connect} from 'react-redux';
import {Map, View} from 'ol';
import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer';
import OSM from 'ol/source/OSM';
import GeoJSON from 'ol/format/GeoJSON';
import {Vector as VectorSource} from 'ol/source';
import axios from 'axios';
import "./MapComponent.css";
import {Stroke, Style, Icon} from "ol/style";

class MapComponent extends Component {
    constructor(props) {
        super(props);
        this.findRouteCancelToken = axios.CancelToken;
        this.findRouteCancel = null;
        this.routeStyle = new Style({
            stroke: new Stroke({
                color: 'blue',
                lineDash: [4],
                width: 3
            })
        });
    }

    componentDidMount() {
        const openStreetMap = new TileLayer({
            source: new OSM()
        });
        this.map = new Map({
            target: 'map',
            layers: [openStreetMap],
            view: new View({
                projection: 'EPSG:4326',
                center: [10, 50],
                zoom: 6
            }),
        });
    }

    componentDidUpdate(prevProps) {
        if (this.props.currentStopsGeoJSON && this.props.currentStopsGeoJSON !== prevProps.currentStopsGeoJSON) {
            // First remove layers
            this.map.getLayers().forEach(layer => {
                if (layer && layer.get('type') === 'markers') {
                    this.map.removeLayer(layer);
                }
            });
            // Then add new ones
            for (let key in this.props.currentStopsGeoJSON) {
                const vectorSource = new VectorSource({
                    features: (new GeoJSON()).readFeatures(this.props.currentStopsGeoJSON[key])
                });
                const vectorLayer = new VectorLayer({
                    source: vectorSource,
                    style: new Style({
                        image: new Icon({
                            crossOrigin: 'anonymous',
                            src: 'img/map-marker.png'
                        })
                    })
                });
                vectorLayer.set('type', 'markers');
                this.map.addLayer(vectorLayer);
                const coordinate = vectorSource.getFeatures()[0].getGeometry().getCoordinates();
                this.map.getView().animate({
                    center: coordinate,
                    duration: 500
                })
            }
            // Draw route
            if (Object.keys(this.props.currentStopsGeoJSON).length > 1) {
                this.drawNewRoute();
            } else {
                this.removeCurrentRoute();
            }
        }
    }

    drawNewRoute = () => {
        if (this.findRouteCancel)
            this.findRouteCancel();
        let hops = [];
        for (let key in this.props.currentStopsGeoJSON) {
            hops.push("!" + this.props.currentStopsGeoJSON[key].properties.id);
        }
        axios.get(this.props.routingUrl, {
            params: {
                via: hops.join("|"),
                mot: this.props.currentMot,
                key: this.props.APIKey
            },
            cancelToken: new this.findRouteCancelToken((cancel) => {
                this.findRouteCancel = cancel;
            })
        })
            .then((response) => {
                const vectorSource = new VectorSource({
                    features: (new GeoJSON()).readFeatures(response.data)
                });
                const vectorLayer = new VectorLayer({
                    source: vectorSource,
                    style: this.routeStyle
                });
                vectorLayer.set('type', 'route');
                this.map.addLayer(vectorLayer);
                this.map.getView().fit(vectorSource.getExtent(), {size: this.map.getSize(), duration: 500});
            }, (error) => {
                console.log(error);
            });
    };

    removeCurrentRoute = () => {
        this.map.getLayers().forEach(layer => {
            if (layer && layer.get('type') === 'route') {
                this.map.removeLayer(layer);
            }
        });
    };

    render() {
        return (
            <div id="map" className="MapComponent"/>
        );
    }
}

const mapStateToProps = state => {
    return {
        currentMot: state.MapReducer.currentMot,
        currentStopsGeoJSON: state.MapReducer.currentStopsGeoJSON,
    };
};

export default connect(mapStateToProps)(MapComponent);